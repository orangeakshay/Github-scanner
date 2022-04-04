const express = require('express')
const router = express.Router()
const githubController = require('../controllers/githubController')
router.get('/repositories', githubController.getRepositoriesList)
router.get('/repo-details', githubController.getRepositoryDetails)
module.exports = router
