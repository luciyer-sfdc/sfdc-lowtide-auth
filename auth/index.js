const jsforce = require("jsforce")

const config = require(appRoot + "/config")

const oauth = require("./oauth")
const session = require("./session")
const credentials = require("./credentials")

const logConnectionFound = (req) => {
  console.log("Salesforce found on session:", req.sessionID)
  console.log("SF Details:", req.session.salesforce.auth_response)
  console.log("Cookie:", req.session.cookie)
}

const logNoConnectionFound = () => {
  console.log("No Salesforce session found. Initializing...")
}

const isAuthEndpoint = (req) => {
  return (
    req.path === config.routes.auth.request ||
    req.path === config.routes.auth.callback ||
    req.path === config.routes.auth.revoke
  )
}

const foundConnection = (req) => {

  const hasConnection = (
    req.session.salesforce &&
    req.session.salesforce.auth_response !== {} &&
    req.session.salesforce.auth_response !== undefined
  )

  if (hasConnection)
    logConnectionFound(req)
  else
    logNoConnectionFound()

  return hasConnection

}

const refreshConnection = (session) => {
  return new jsforce.Connection(session.salesforce.auth_response)
}

const handleAuthRequired = (req, res, next) => {

  if (!isAuthEndpoint(req) && !foundConnection(req))
    return res.status(500).json({
      message: "Not authenticated with Salesforce. Please POST to /api/auth."
    })

  next()

}

const visitedAuth = (req, res) => {

  console.log("Authorizing with Oauth2. Redirecting.")

  res.redirect(oauth.getUrl())

}


const routeRequest = (req, res) => {

  if (foundConnection(req))
    return res.status(200).json({
      message: `Authenticated at: ${req.session.salesforce.auth_response.instanceUrl}`
    })

  if (req.body.source === "session") {

    console.log("Authorizing with Salesforce Session.")

    session.store(req)
      .then(sf => {
        req.session.salesforce = sf
        res.sendStatus(200)
      })
      .catch(err => {
        console.error(err)
        res.status(500).json({
          message: err.message
        })
      })

  } else if (req.body.source === "credentials") {

    console.log("Authorizing with Username and Password.")

    credentials.store(req)
      .then(sf => {
        req.session.salesforce = sf
        res.sendStatus(200)
      })
      .catch(err => {
        console.error(err)
        res.status(500).json({
          message: err.message
        })
      })

  } else {
    res.status(500).json({
      message: "Must set request source."
    })
  }

}

const handleOauthCallback = (req, res) => {

  oauth.store(req)
    .then(sf => {

      console.log("Redirecting to Homepage.")

      req.session.salesforce = sf
      res.redirect("/")

    })
    .catch(error => {
      console.error(error)
      res.status(500).json(error.message)
    })

}

const destroyConnection = (req, res) => {

  if (foundConnection(req)) {

    const conn = refreshConnection(req.session)

    conn.logout()
      .then(() => {
        req.session.destroy(() => {
          res.status(200).json({ message: "Logout successful." })
        })
      })
      .catch(err => {
        res.status(500).json(error)
      })

  } else {
    res.status(500).json({
      message: "No Salesforce connection found."
    })
  }

}


module.exports = {

  foundConnection: foundConnection,
  isAuthEndpoint: isAuthEndpoint,
  refreshConnection: refreshConnection,

  handleAuthRequired: handleAuthRequired,
  visitedAuth: visitedAuth,
  routeRequest: routeRequest,
  handleOauthCallback: handleOauthCallback,
  destroyConnection: destroyConnection,

  oauth: oauth,
  session: session,
  credentials: credentials

}
