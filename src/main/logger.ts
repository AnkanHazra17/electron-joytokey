import log from 'electron-log'

log.initialize({ preload: true })
log.transports.file.level = 'info'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'

export default log
