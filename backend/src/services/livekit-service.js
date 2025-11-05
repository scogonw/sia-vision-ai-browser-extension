import { AccessToken } from 'livekit-server-sdk'
import { env } from '../config/env.js'
import crypto from 'node:crypto'

export class LiveKitService {
  constructor () {
    this.apiKey = env.livekit.apiKey
    this.apiSecret = env.livekit.apiSecret
    this.host = env.livekit.host
    this.tokenTtlSeconds = env.livekit.tokenTtlSeconds
  }

  createRoomName (organizationId, userId) {
    const suffix = crypto.randomBytes(4).toString('hex')
    return `support-${organizationId || 'default'}-${userId}-${suffix}`
  }

  generateToken ({ identity, name, metadata, roomName }) {
    const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name,
      ttl: this.tokenTtlSeconds,
      metadata: JSON.stringify(metadata)
    })

    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true
    })

    return accessToken.toJwt()
  }
}

export const liveKitService = new LiveKitService()
