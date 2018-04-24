const {dirname} = require('path')

const appRootPath       = require('app-root-path')
const callerCallsite    = require('caller-callsite')
const dotenv            = require('dotenv')
const {sync: findUp}    = require('find-up')
const minimist          = require('minimist')
const {sync: readPkgUp} = require('read-pkg-up')
const string2js         = require('string2js')


const NPM_PACKAGE_CONFIG_REGEX = /^npm_package_config_(.+)/


function parseEnv(env)
{
  return Object.entries(env).reduce(reduceEnv, {})
}

function reduceEnv(acum, [key, value])
{
  acum[key] = string2js(value)

  return acum
}

function unifyConfig([key, value])
{
  if(!this.hasOwnProperty(key)) this[key] = value
}

function unifyEnv([key, value])
{
  const matches = key.match(NPM_PACKAGE_CONFIG_REGEX)
  if(!matches) return

  // Add `npm` config variable if the same environment one is not already set
  unifyConfig([matches[1], value])

  delete this[key]
}

function unifyPackageConfig(cwd, env)
{
  const {pkg: {config = {}} = {}} = readPkgUp({cwd})
  Object.entries(config).forEach(unifyConfig, env)
}


/**
 * Unify config from `package.json`, `.env` file, environment variables and argv
 *
 * Unified configuration is available on `process.env` and values already parsed
 * as returned value
 *
 * @return {Object} parsed unified configuration
 */
function config(argv, options)
{
  if(argv && argv.constructor.name === 'Object')
  {
    options = argv
    argv = null
  }

  const {env = process.env, path} = options || {}

  // argv - higher priority over environment variables
  if(!argv) argv = process.argv.slice(2)
  Object.assign(env, minimist(argv))

  // dotenv
  const {error} = dotenv.config({path: path || findUp('.env')})
  if(error && error.code !== 'ENOENT') throw error

  // npm config
  Object.entries(env).forEach(unifyEnv, env)

  // `config` entry at project root `package.json` (in case not using `npm run`)
  unifyPackageConfig(appRootPath.toString(), env)

  // `config` entry at `package.json` of caller module (for dependencies)
  unifyPackageConfig(dirname(callerCallsite().getFileName()), env)

  // return parsed environment variables
  return parseEnv(env)
}

config.parseEnv = parseEnv


module.exports = config
