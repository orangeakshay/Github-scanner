const githubService = require('../services/githubService');
const loggerName = 'GithubController'

 module.exports.getRepositoriesList = async(req, res,next)=> {
     const methodName = loggerName + '[GetRepositoriesList]'
     try {
         const username = req.query.username;
         const repositoryList = await githubService.getRepositoriesList({
             ownerName: username
         })
         return res.status(200).json(repositoryList)
     } catch (err) {
         console.error(methodName, err);
         return next(err)
     }
 }

 module.exports.getRepositoryDetails = async(req, res, next) => {
    const methodName = loggerName + 'GetRepositoryDetails'
         try {
             const username = req.query.username;
             const repoName = req.query.reponame;
             const response = await githubService.getRepositoryDetails({
                 ownerName: username,
                 repositoryName: repoName
             })
             return res.status(200).json(response)
         } catch (err) {
             console.error(methodName, err);
             return next(err)
         }
     }