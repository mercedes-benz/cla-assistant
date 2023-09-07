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


    console.log("\n\n *****       Checking authentication  ***** \n\n") 

    if (req.isAuthenticated()) {
        try {

            console.log("\n\n *****       Calling cla.sign()... ***** \n\n")
            await cla.sign(req)

            console.log("\n\n *****       ...cla.sign() ***** \n\n")
        } catch (e) {
            logger.debug("\n\n *****       Found error ***** \n\n")
            if (e && (!e.code || e.code != 200)) {
                logger.error(e)

                return
            }
        }


        console.log("\n\n *****       redirecting ... ***** \n\n")
        let redirectUrl = `/${req.args.owner}/${req.args.repo}?redirect=true`
        redirectUrl = req.query.pullRequest ? `${redirectUrl}&pullRequest=${req.query.pullRequest}` : redirectUrl
        res.redirect(redirectUrl)
    } else {

        console.log("\n\n *****       redirecting to auth... ***** \n\n")
        req.session.next = req.originalUrl
        return res.redirect('/auth/github?public=true')
    }
})

router.use('/signin/:owner/:repo', (req, res) => {
    console.log("\n\n *** signin owner repo *** \n\n")
    let redirectUrl = `/${req.params.owner}/${req.params.repo}`
    req.session.next = req.query.pullRequest ? `${redirectUrl}?pullRequest=${req.query.pullRequest}` : redirectUrl
    console.log(req.session.next)
    console.log("\n\n ***** \n\n")
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
    if (req.path === '/robots.txt') {
        return res.status(200).sendFile(path.join(__dirname, '..', '..', '..', 'client', 'assets', 'robots.txt'))
    } else if (req.user) {
        if (req.path !== '/') {
            return res.status(200).sendFile(config.server.templates.login)
        }
        if (adminModeEnabled() && couldBeAdmin(req.user.login)) {
            if(req.user.scope && req.user.scope.indexOf('write:repo_hook') > -1) {
                return res.status(200).sendFile(config.server.templates.login)
            }
        } else if(adminModeEnabled()) {
            return res.redirect(302, '/my-cla')
        } else {
            return res.status(200).sendFile(config.server.templates.login)
        }
    }
    res.setHeader('Last-Modified', (new Date()).toUTCString())
    return res.status(200).sendFile(config.server.templates.login)

})

module.exports = router
