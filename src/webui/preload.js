import toPull from 'stream-to-pull-stream'
import { ipcRenderer, remote } from 'electron'
import readdir from 'recursive-readdir'
import fs from 'fs-extra'
import path from 'path'
import screenshotHook from './screenshot'
import connectionHook from './connection-status'
import pkg from '../../package.json'

const COUNTLY_KEY = '47fbb3db3426d2ae32b3b65fe40c564063d8b55d'
const COUNTLY_KEY_TEST = '6b00e04fa5370b1ce361d2f24a09c74254eee382'

screenshotHook()
connectionHook()

var originalSetItem = window.localStorage.setItem
window.localStorage.setItem = function () {
  if (arguments[0] === 'i18nextLng') {
    ipcRenderer.send('updateLanguage', arguments[1])
  }

  originalSetItem.apply(this, arguments)
}

ipcRenderer.on('updatedPage', (_, url) => {
  window.location.hash = url
})

window.ipfsDesktop = {
  countlyAppKey: process.env.NODE_ENV === 'development' ? COUNTLY_KEY_TEST : COUNTLY_KEY,

  version: pkg.version,

  onConfigChanged: (listener) => {
    ipcRenderer.on('config.changed', (_, config) => {
      listener(config)
    })

    ipcRenderer.send('config.get')
  },

  toggleSetting: (setting) => {
    ipcRenderer.send('config.toggle', setting)
  },

  configHasChanged: () => {
    ipcRenderer.send('ipfsConfigChanged')
  },

  selectDirectory: () => {
    return new Promise(resolve => {
      remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        title: 'Select a directory',
        properties: [
          'openDirectory',
          'createDirectory'
        ]
      }, async (res) => {
        if (!res || res.length === 0) {
          return resolve()
        }

        const files = []

        const prefix = path.dirname(res[0])

        for (const path of await readdir(res[0])) {
          const size = (await fs.stat(path)).size
          files.push({
            path: path.substring(prefix.length, path.length),
            content: toPull.source(fs.createReadStream(path)),
            size: size
          })
        }

        resolve(files)
      })
    })
  }
}

// This preload script creates the window.ipfs object with
// the apiAddress in the URL.
const urlParams = new URLSearchParams(window.location.search)
const apiAddress = urlParams.get('api')

// Inject api address
window.localStorage.setItem('ipfsApi', apiAddress)
