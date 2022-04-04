const { gql } = require('graphql-request');
const { getGraphqlClient } = require('../lib/graphqlClient');
const { Octokit } = require("@octokit/rest");
const CONSTANTS = require('../lib/constants');
const util = require('../util/checkFileName');
const M = require('../lib/messages')
const AppError = require('../AppError')
const loggerName = '[GithubService]'
const GraphqlClient = getGraphqlClient()
  //get list of user repositories
  const getRepositoriesList  = (options = {})=> {
  const methodName = loggerName + 'GetRepositoriesList'
    return new Promise(async(resolve, reject)=>{
      try{
        if(!options.ownerName){
          return reject(new AppError(M.ERR_OWNER_NAME_IS_REQUIRED, 'ERR_OWNER_NAME_IS_REQUIRED'))        }
        if(!options.maxRepos){
          options.maxRepos = 100
        }
    const variables = {};
    const query = gql`{
      repositoryOwner(login: "${options.ownerName}") {
        repositories(first: ${options.maxRepos}) {
          nodes {
            name
            diskUsage
            owner {          
              login
            }
          }
        }
      }
    }`;
    const responses = await GraphqlClient.request(query, variables);
    const getRepos = responses.repositoryOwner.repositories;
    let result = [];
        getRepos['nodes'].map((repo) => {
      const { name, diskUsage } = repo;
      const { login } = repo.owner;
          result.push({
        "Repository Name": name,
        "Repository Size":diskUsage,
        "Repository Owner":login
      });
    });

    return resolve(result);
      }catch(err){
        console.log(methodName, err)
        return reject(err)
      }
    })
  }

  //get repository details
  const getRepositoryDetails = (options = {})=> {
  const methodName = loggerName + 'GetRepositoryDetails'
  return new Promise(async(resolve, reject)=> {
  try{
    if(!options.ownerName){
      return reject(new AppError(M.ERR_OWNER_NAME_IS_REQUIRED, 'ERR_OWNER_NAME_IS_REQUIRED'))
    }
    if(!options.repositoryName){
      return reject(new AppError(M.ERR_REPOSITORY_NAME_IS_REQUIRED, 'ERR_REPOSITORY_NAME_IS_REQUIRED'))
    }

    const variables = {};
    const query = gql`{
      repository(owner: "${options.ownerName}", name: "${options.repositoryName}") {
        name
        diskUsage
        isPrivate
        owner {
          login
        }   
        object(expression: "HEAD:") {
          ... on Tree {
            entries {
              name
              type
              object {
                ... on Blob {
                  byteSize                  
                }
                ... on Tree {
                  entries {
                    name
                    type
                    object {
                      ... on Blob {
                        byteSize                        
                      }
                    }
                  }
                }
              }
            }
          }
        }        
      }  
    }
  `;
    const data = await GraphqlClient.request(query, variables);
    let result = [];
    const {name, diskUsage, isPrivate} = data.repository;
    const {login} = data.repository.owner;
    let entries = JSON.parse(JSON.stringify(data.repository.object));
    const {folderCount, fileCount} = await getFileCount(
        {
          files:entries
        });
    const activeWebhooks = await checkWebhooks(
        {
          ownerName:options.ownerName,
          repositoryName: options.repositoryName
    });
    const {text, haveYmlFile} = await checkYml({
      files: entries,
      ownerName:options.ownerName,
      repositoryName: options.repositoryName
    });

    result.push({
      "Repository Name": name,
      "Repository Size": diskUsage,
      "Repository Owner": login,
      "Repository is Private": isPrivate,
      "Number of Files on Root Level": fileCount,
      "Number of Folders on Root Level": folderCount,
      "Have YML File": haveYmlFile,
      "Content of YML File": text,
      "Active Webhooks": activeWebhooks
    });
    return resolve(result);
  }catch(err){
    console.error(methodName, err)
      return reject(err)
    }
  })
  }


  const checkYml = (options = {}) =>{
  const methodName = loggerName + '[CheckYml]'
  return new Promise(async(resolve, reject)=>{
    try{
      if(!options.files){
        return reject(new AppError(M.ERR_FILES_REQUIRED, 'ERR_FILES_REQUIRED'))
      }
      if(!options.ownerName){
        return reject(new AppError(M.ERR_OWNER_NAME_IS_REQUIRED, 'ERR_OWNER_NAME_IS_REQUIRED'))
      }
      if(!options.repositoryName){
        return reject(new AppError(M.ERR_REPOSITORY_NAME_IS_REQUIRED, 'ERR_REPOSITORY_NAME_IS_REQUIRED'))
      }
    let text = '';
    for(let i=0;i<options.files.entries.length;i++){
      let splitArr = options.files.entries[i].name.split('.');
      if(splitArr[1]){        
        if(await util.validateFileExtension(options.files.entries[i].name,CONSTANTS.YML_EXTENSION)) {
          let variables = {};
          let query = gql`{repository(owner: "${options.ownerName}", name: "${options.repositoryName}") {
            content: object(expression: "HEAD:${splitArr[0]}.yml") {
              ... on Blob {
                text
              }
            }
          }}`;
          let data = await GraphqlClient.request(query, variables);
          return resolve({text:data.repository.content.text,haveYmlFile:true})
       }  
      }        
    }   
    return {text:text,haveYmlFile:false};
    }catch(err){
      console.error(methodName, err)
      return reject(err)
    }
  })
  }

  const getFileCount = (options = {})=> {
  const methodName = loggerName + 'GetFileCount'
  return new Promise(async(resolve, reject)=> {
    try{
      if(!options.files){
        return reject(new AppError(M.ERR_FILES_REQUIRED, 'ERR_FILES_REQUIRED'))
      }

    let files = 0;
    let folders = 0;

    const listOfFiles = options.files.entries.filter(it => it.type === 'blob');
    const listOfFolder = options.files.entries.filter(it => it.type === 'tree');

    files += listOfFiles.length;
    folders += listOfFolder.length;

    return resolve({folderCount: folders, fileCount: files})
  }catch(err){
      console.error(methodName, err)
      return reject(err)
    }
  })
  }

  const checkWebhooks = (options = {})=> {
  const methodName = loggerName + 'checkWebhooks'
  return new Promise(async(resolve, reject)=>{
      try{
        if(!options.ownerName){
          return reject(new AppError(M.ERR_OWNER_NAME_IS_REQUIRED, 'ERR_OWNER_NAME_IS_REQUIRED'))
        }
        if(!options.repositoryName){
          return reject(new AppError(M.ERR_REPOSITORY_NAME_IS_REQUIRED, 'ERR_REPOSITORY_NAME_IS_REQUIRED'))
        }
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN || '',
        });
        const response = await octokit.rest.repos.listWebhooks({
          owner: options.ownerName,
          repo: options.repositoryName
        })

        if(response.data.length < 1){
          return resolve({message:'NO ACTIVE WEBHOOKS'});
        } else {
          return resolve(response.data);
        }
      } catch(err) {
       console.error(methodName, err)
        return reject(err)
      }
  })
  }

  module.exports = {getRepositoriesList, getRepositoryDetails}