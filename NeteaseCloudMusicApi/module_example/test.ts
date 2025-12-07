import { banner, lyric } from '@neteasecloudmusicapienhanced/api'
import { logger } from '../util/logger.js'
banner({ type: 0 }).then((res) => {
  logger.info(res)
})
lyric({
  id: '33894312',
}).then((res) => {
  logger.info(res)
})
