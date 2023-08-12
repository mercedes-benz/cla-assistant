// SPDX-FileCopyrightText: 2022 SAP SE or an SAP affiliate company and CLA-assistant contributors
//
// SPDX-License-Identifier: Apache-2.0

const express = require('express')
const path = require('path')
const config = require('../config')
const { couldBeAdmin, adminModeEnabled } = require('../middleware/utils')
const cla = require('./../api/cla')
const logger = require('./../services/logger')
//////////////////////////////////////////////////////////////////////////////////////////////
// Default router
//////////////////////////////////////////////////////////////////////////////////////////////

const router = express.Router()

// router.use('/accept', function(req, res) {
router.use('/accept/:owner/:repo', async (req, res) => {
    res.set({ 'Cache-Control': 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0' })

    req.args = {
        owner: req.params.owner,
        repo: req.params.repo
    }

    logger.debug(' *****       Checking authentication  ***** ')
    console.log(' *****       Checking authentication  ***** ') 

    if (req.isAuthenticated()) {
        try {
            logger.debug(' *****       Calling cla.sign()... ***** ')
            console.log(' *****       Calling cla.sign()... ***** ')
            await cla.sign(req)
            logger.debug(' *****       ...cla.sign() ***** ')
            console.log(' *****       ...cla.sign() ***** ')
        } catch (e) {
            logger.debug(' *****       Found error ***** ')
            if (e && (!e.code || e.code != 200)) {
                logger.error(e)

                return
            }
        }

        logger.debug(' *****       redirecting ... ***** ')
        console.log(' *****       redirecting ... ***** ')
        let redirectUrl = `/${req.args.owner}/${req.args.repo}?redirect=true`
        redirectUrl = req.query.pullRequest ? `${redirectUrl}&pullRequest=${req.query.pullRequest}` : redirectUrl
        res.redirect(redirectUrl)
    } else {
        logger.debug(' *****       redirecting to auth... ***** ')
        console.log(' *****       redirecting to auth... ***** ')
        req.session.next = req.originalUrl
        return res.redirect('/auth/github?public=true')
    }
})

router.use('/signin/:owner/:repo', (req, res) => {
    let redirectUrl = `/${req.params.owner}/${req.params.repo}`
    req.session.next = req.query.pullRequest ? `${redirectUrl}?pullRequest=${req.query.pullRequest}` : redirectUrl

    return res.redirect('/auth/github?public=true')
})

router.all('/static/*', (req, res) => {
    let filePath
    if (req.user && req.path === '/static/cla-assistant.json') {
        filePath = path.join(__dirname, '..', '..', '..', '..', 'cla-assistant.json')
    } else {
        filePath = config.server.templates.login
    }
    res.setHeader('Last-Modified', (new Date()).toUTCString())
    res.status(200).sendFile(filePath)
})

router.get('/check/:owner/:repo', (req, res) => {
    let referer = req.header('Referer')
    let back = referer && referer.includes('github.com') ? referer : 'https://github.com'
    logger.info('Recheck PR requested for ', `https://github.com/${req.params.owner}/${req.params.repo}/pull/${req.query.pullRequest}`, `referer was ${referer}`)
    cla.validatePullRequest({
        owner: req.params.owner,
        repo: req.params.repo,
        number: req.query.pullRequest
    })
    res.redirect(back)
})


router.all('/*', (req, res) => {
    res.setHeader('Last-Modified', (new Date()).toUTCString())

    // aravind
    console.log("\n\n *** req  ***\n")

    if (req.path === '/robots.txt') {
        console.log("\n\n *** robots.txt *** \n\n ")
        return res.status(200).sendFile(path.join(__dirname, '..', '..', '..', 'client', 'assets', 'robots.txt'))
    } else if (req.user) {
        if (req.path !== '/') {
            console.log("\n\n *** root / *** \n\n ")
            return res.status(200).sendFile(path.join(__dirname, '..', '..', '..', 'client', 'assets', 'home.html'))
        }
        if (adminModeEnabled() && couldBeAdmin(req.user.login)) {
            console.log("\n\n *** adminModeEnabled and cloudBeAdmin / *** \n\n ")
            return routeBasedOnWriteRepoHookPermission(req, res)
        } else if(adminModeEnabled()) {
            console.log("\n\n *** adminModeEnabled / *** \n\n ")
            return res.redirect(302, '/my-cla')
        }

        console.log("\n\n *** routeBasedOnWriteRepoHookPermission / *** \n\n ")
        return routeBasedOnWriteRepoHookPermission(req, res)
    }

    console.log("\n\n *** config.server.templates.login / *** \n\n ")
    return res.status(200).sendFile(config.server.templates.login)
})

function routeBasedOnWriteRepoHookPermission(req, res) {
    if(req.user.scope && req.user.scope.indexOf('write:repo_hook') > -1) {
        return res.status(200).sendFile(path.join(__dirname, '..', '..', '..', 'client', 'assets', 'home.html'))
    }
    return res.redirect(302, '/my-cla')
}

module.exports = router
