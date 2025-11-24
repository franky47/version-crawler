import pino from 'pino'

const defaultLogLevel = process.env.NODE_ENV === 'test' ? 'silent' : 'info'

export const logger = pino({
  level: process.env.LOG_LEVEL || defaultLogLevel,
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
})
