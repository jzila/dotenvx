const t = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const which = require('which')
const dotenv = require('dotenv')
const { execSync } = require('child_process')

const node = path.resolve(which.sync('node')) // /opt/homebrew/node
const packageJson = require('../../src/lib/helpers/packageJson')
const version = packageJson.version

const tempDir = fs.realpathSync(os.tmpdir())
const originalDir = process.cwd()

function execShell (commands) {
  return execSync(commands, {
    encoding: 'utf8',
    shell: true,
    env: {
      ...process.env,
      PATH: process.env.PATH // Ensure the PATH environment variable is passed
    }
  }).trim()
}

t.beforeEach((ct) => {
  // important, clear process.env before each test
  process.env = {}

  // go to tempDir
  process.chdir(tempDir)
})

t.afterEach((ct) => {
  // cleanup
  process.chdir(originalDir)
})

t.test('#--version', ct => {
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} --version`), version)

  ct.end()
})

t.test('#run', ct => {
  execShell(`
    echo "HELLO=World" > .env
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const command = `${node} index.js`
  ct.equal(execShell(`${node} index.js`), 'Hello undefined')
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -- ${command}`), `[dotenvx@${version}] injecting env (1) from .env\nHello World`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --quiet -- ${command}`), 'Hello World') // --quiet
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --debug -- ${command}`), `Setting log level to debug
process command [${node} index.js]
options: {"env":[],"envFile":[],"envVaultFile":[]}
loading env from .env (${tempDir}/.env)
{"HELLO":"World"}
HELLO set
HELLO set to World
[dotenvx@${version}] injecting env (1) from .env
executing process command [${node} index.js]
expanding process command to [${node} index.js]
Hello World`) // --debug

  ct.end()
})

t.test('#run - multiple .env files', ct => {
  execShell(`
    echo "HELLO=local" > .env.local
    echo "HELLO=World" > .env
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const command = `${node} index.js`
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -f .env.local -f .env -- ${command}`), `[dotenvx@${version}] injecting env (1) from .env.local, .env\nHello local`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -f .env.local -f .env --quiet -- ${command}`), 'Hello local') // --quiet
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -f .env.local -f .env --debug -- ${command}`), `Setting log level to debug
process command [${node} index.js]
options: {"env":[],"envFile":[".env.local",".env"],"envVaultFile":[]}
loading env from .env.local (${tempDir}/.env.local)
{"HELLO":"local"}
HELLO set
HELLO set to local
loading env from .env (${tempDir}/.env)
{"HELLO":"World"}
HELLO pre-exists (protip: use --overload to override)
HELLO pre-exists as local (protip: use --overload to override)
[dotenvx@${version}] injecting env (1) from .env.local, .env
executing process command [${node} index.js]
expanding process command to [${node} index.js]
Hello local`) // --debug

  ct.end()
})

t.test('#run - multiple .env files --overload', ct => {
  execShell(`
    echo "HELLO=local" > .env.local
    echo "HELLO=World" > .env
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const command = `${node} index.js`
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -f .env.local -f .env --overload -- ${command}`), `[dotenvx@${version}] injecting env (1) from .env.local, .env\nHello World`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -f .env.local -f .env --overload --quiet -- ${command}`), 'Hello World') // --quiet
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -f .env.local -f .env --overload --debug -- ${command}`), `Setting log level to debug
process command [${node} index.js]
options: {"env":[],"envFile":[".env.local",".env"],"envVaultFile":[],"overload":true}
loading env from .env.local (${tempDir}/.env.local)
{"HELLO":"local"}
HELLO set
HELLO set to local
loading env from .env (${tempDir}/.env)
{"HELLO":"World"}
HELLO set
HELLO set to World
[dotenvx@${version}] injecting env (1) from .env.local, .env
executing process command [${node} index.js]
expanding process command to [${node} index.js]
Hello World`) // --debug

  ct.end()
})

t.test('#run - Variable Expansion', ct => {
  execShell(`
    echo 'USERNAME="username"\nDATABASE_URL="postgres://\${USERNAME}@localhost/my_database"' > .env
    echo "console.log('DATABASE_URL', process.env.DATABASE_URL)" > index.js
  `)

  const command = `${node} index.js`
  ct.equal(execShell(`${node} index.js`), 'DATABASE_URL undefined')
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --quiet -- ${command}`), 'DATABASE_URL postgres://username@localhost/my_database')

  ct.end()
})

t.test('#run - Command Substitution', ct => {
  execShell(`
    echo 'DATABASE_URL="postgres://\$(whoami)@localhost/my_database"' > .env
    echo "console.log('DATABASE_URL', process.env.DATABASE_URL)" > index.js
  `)

  const command = `${node} index.js`
  const whoami = execShell('whoami')
  ct.equal(execShell(`${node} index.js`), 'DATABASE_URL undefined')
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --quiet -- ${command}`), `DATABASE_URL postgres://${whoami}@localhost/my_database`)

  ct.end()
})

t.test('#run - --env', ct => {
  execShell(`
    echo "HELLO=World" > .env
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const command = `${node} index.js`
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --env HELLO=String -f .env -- ${command}`), `[dotenvx@${version}] injecting env (1) from .env, and --env flag\nHello String`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --env HELLO=String -f .env --quiet -- ${command}`), 'Hello String') // --quiet
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --env HELLO=String -f .env --debug -- ${command}`), `Setting log level to debug
process command [${node} index.js]
options: {"env":["HELLO=String"],"envFile":[".env"],"envVaultFile":[]}
loading env from string (HELLO=String)
{"HELLO":"String"}
HELLO set
HELLO set to String
loading env from .env (${tempDir}/.env)
{"HELLO":"World"}
HELLO pre-exists (protip: use --overload to override)
HELLO pre-exists as String (protip: use --overload to override)
[dotenvx@${version}] injecting env (1) from .env, and --env flag
executing process command [${node} index.js]
expanding process command to [${node} index.js]
Hello String`) // --debug

  ct.end()
})

t.test('#run - encrypted .env', ct => {
  execShell(`
    rm .env
    touch .env
    ${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} set HELLO encrypted
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const parsedEnv = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env')))
  const parsedEnvKeys = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env.keys')))

  const DOTENV_PUBLIC_KEY = parsedEnv.DOTENV_PUBLIC_KEY
  const DOTENV_PRIVATE_KEY = parsedEnvKeys.DOTENV_PRIVATE_KEY

  const command = `${node} index.js`
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -- ${command}`), `[dotenvx@${version}] injecting env (2) from .env\nHello encrypted`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --quiet -- ${command}`), 'Hello encrypted') // --quiet
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --debug -- ${command}`), `Setting log level to debug
process command [${node} index.js]
options: {"env":[],"envFile":[],"envVaultFile":[]}
loading env from .env (${tempDir}/.env)
{"DOTENV_PUBLIC_KEY":"${DOTENV_PUBLIC_KEY}","HELLO":"encrypted"}
DOTENV_PUBLIC_KEY set
DOTENV_PUBLIC_KEY set to ${DOTENV_PUBLIC_KEY}
HELLO set
HELLO set to encrypted
[dotenvx@${version}] injecting env (2) from .env
executing process command [${node} index.js]
expanding process command to [${node} index.js]
Hello encrypted`) // --debug

  ct.end()
})

t.test('#run - encrypted .env with no .env.keys', ct => {
  execShell(`
    rm .env
    touch .env
    ${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} set HELLO encrypted
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const parsedEnv = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env')))
  const parsedEnvKeys = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env.keys')))

  const DOTENV_PUBLIC_KEY = parsedEnv.DOTENV_PUBLIC_KEY
  const DOTENV_PRIVATE_KEY = parsedEnvKeys.DOTENV_PRIVATE_KEY
  const encrypted = parsedEnv.HELLO

  execShell(`rm .env.keys`)

  const command = `${node} index.js`
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -- ${command}`), `[dotenvx@${version}] injecting env (2) from .env\nHello ${encrypted}`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --quiet -- ${command}`), `Hello ${encrypted}`) // --quiet
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --debug -- ${command}`), `Setting log level to debug
process command [${node} index.js]
options: {"env":[],"envFile":[],"envVaultFile":[]}
loading env from .env (${tempDir}/.env)
{"DOTENV_PUBLIC_KEY":"${DOTENV_PUBLIC_KEY}","HELLO":"${encrypted}"}
DOTENV_PUBLIC_KEY set
DOTENV_PUBLIC_KEY set to ${DOTENV_PUBLIC_KEY}
HELLO set
HELLO set to ${encrypted}
[dotenvx@${version}] injecting env (2) from .env
executing process command [${node} index.js]
expanding process command to [${node} index.js]
Hello ${encrypted}`) // --debug

  ct.end()
})

t.test('#run - encrypted .env with no .env.keys, with DOTENV_PRIVATE_KEY', ct => {
  execShell(`
    rm .env
    touch .env
    ${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} set HELLO encrypted
    echo "console.log('Hello ' + process.env.HELLO)" > index.js
  `)

  const parsedEnv = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env')))
  const parsedEnvKeys = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env.keys')))

  const DOTENV_PUBLIC_KEY = parsedEnv.DOTENV_PUBLIC_KEY
  const DOTENV_PRIVATE_KEY = parsedEnvKeys.DOTENV_PRIVATE_KEY

  execShell(`rm .env.keys`) // no keys file

  process.env.DOTENV_PRIVATE_KEY = DOTENV_PRIVATE_KEY // set already on server

  const command = `${node} index.js`
  ct.equal(execShell(`DOTENV_PRIVATE_KEY=${DOTENV_PRIVATE_KEY} ${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run -- ${command}`), `[dotenvx@${version}] injecting env (2) from .env\nHello encrypted`)
  ct.equal(execShell(`${node} ${path.join(originalDir, 'src/cli/dotenvx.js')} run --quiet -- ${command}`), 'Hello encrypted') // --quiet

  ct.end()
})
