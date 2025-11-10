/**
 * Webhook Events Service
 * 
 * Integrates webhook events with the existing authentication system.
 * Automatically triggers webhook events for user actions, security events,
 * organization changes, and session management.
 */

import webhookService from './webhook.js'
import config from '../config/index.js'

/**
 * Webhook Events Service Class
 */
export class WebhookEventsService {
  constructor() {
    this.enabled = config.features?.webhooks || false
    
    if (!this.enabled) {
      console.log('Webhook events disabled in configuration')
      return
    }
    
    console.log('Webhook events service initialized')
  }
  
  /**
   * Trigger user created event
   */
  async triggerUserCreated(user, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified || user.emailVerified,
          status: user.status,
          metadata: user.metadata || {},
          created_at: user.created_at || user.createdAt,
        },
        organization_id: options.orgId,
        created_by: options.createdBy,
      }
      
      return await webhookService.triggerEvent('user.created', payload, {
        orgId: options.orgId,
        triggeredBy: options.createdBy,
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger user.created webhook:', error.message)
    }
  }
  
  /**
   * Trigger user updated event
   */
  async triggerUserUpdated(user, changes = {}, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified || user.emailVerified,
          status: user.status,
          metadata: user.metadata || {},
          updated_at: user.updated_at || user.updatedAt,
        },
        changes,
        organization_id: options.orgId,
        updated_by: options.updatedBy,
      }
      
      return await webhookService.triggerEvent('user.updated', payload, {
        orgId: options.orgId,
        triggeredBy: options.updatedBy,
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger user.updated webhook:', error.message)
    }
  }
  
  /**
   * Trigger user deleted event
   */
  async triggerUserDeleted(user, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
          deleted_at: new Date().toISOString(),
        },
        organization_id: options.orgId,
        deleted_by: options.deletedBy,
      }
      
      return await webhookService.triggerEvent('user.deleted', payload, {
        orgId: options.orgId,
        triggeredBy: options.deletedBy,
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger user.deleted webhook:', error.message)
    }
  }
  
  /**
   * Trigger user login event
   */
  async triggerUserLogin(user, session, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified || user.emailVerified,
        },
        session: {
          id: session.jti,
          device_info: session.device_info || session.deviceInfo,
          ip: session.ip,
          user_agent: session.user_agent || session.userAgent,
          created_at: session.created_at || session.createdAt,
          expires_at: session.expires_at || session.expiresAt,
        },
        organization_id: options.orgId,
        login_method: options.loginMethod || 'magic_link',
        is_new_device: options.isNewDevice || false,
        location: options.location,
      }
      
      return await webhookService.triggerEvent('user.login', payload, {
        orgId: options.orgId,
        triggeredBy: user.id,
        resourceType: 'session',
        resourceId: session.jti,
        metadata: {
          ip: session.ip,
          user_agent: session.user_agent || session.userAgent,
          login_method: options.loginMethod,
        },
      })
    } catch (error) {
      console.error('Failed to trigger user.login webhook:', error.message)
    }
  }
  
  /**
   * Trigger user logout event
   */
  async triggerUserLogout(user, session, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
        },
        session: {
          id: session.jti,
          duration: options.sessionDuration,
          logout_reason: options.logoutReason || 'user_initiated',
        },
        organization_id: options.orgId,
        logout_method: options.logoutMethod || 'explicit',
      }
      
      return await webhookService.triggerEvent('user.logout', payload, {
        orgId: options.orgId,
        triggeredBy: user.id,
        resourceType: 'session',
        resourceId: session.jti,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
          logout_reason: options.logoutReason,
        },
      })
    } catch (error) {
      console.error('Failed to trigger user.logout webhook:', error.message)
    }
  }
  
  /**
   * Trigger organization created event
   */
  async triggerOrganizationCreated(organization, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          settings: organization.settings || {},
          created_at: organization.created_at || organization.createdAt,
        },
        created_by: options.createdBy,
      }
      
      return await webhookService.triggerEvent('organization.created', payload, {
        orgId: organization.id,
        triggeredBy: options.createdBy,
        resourceType: 'organization',
        resourceId: organization.id,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger organization.created webhook:', error.message)
    }
  }
  
  /**
   * Trigger organization updated event
   */
  async triggerOrganizationUpdated(organization, changes = {}, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          settings: organization.settings || {},
          updated_at: organization.updated_at || organization.updatedAt,
        },
        changes,
        updated_by: options.updatedBy,
      }
      
      return await webhookService.triggerEvent('organization.updated', payload, {
        orgId: organization.id,
        triggeredBy: options.updatedBy,
        resourceType: 'organization',
        resourceId: organization.id,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger organization.updated webhook:', error.message)
    }
  }
  
  /**
   * Trigger organization deleted event
   */
  async triggerOrganizationDeleted(organization, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          deleted_at: new Date().toISOString(),
        },
        deleted_by: options.deletedBy,
      }
      
      return await webhookService.triggerEvent('organization.deleted', payload, {
        orgId: organization.id,
        triggeredBy: options.deletedBy,
        resourceType: 'organization',
        resourceId: organization.id,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger organization.deleted webhook:', error.message)
    }
  }
  
  /**
   * Trigger membership created event
   */
  async triggerMembershipCreated(membership, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        membership: {
          organization_id: membership.org_id,
          user_id: membership.user_id,
          role: membership.role,
          permissions: membership.permissions || [],
          invited_by: membership.invited_by,
          invited_at: membership.invited_at,
          joined_at: membership.joined_at || new Date().toISOString(),
        },
        organization_id: membership.org_id,
        invited_by: options.invitedBy || membership.invited_by,
      }
      
      return await webhookService.triggerEvent('membership.created', payload, {
        orgId: membership.org_id,
        triggeredBy: options.invitedBy || membership.invited_by,
        resourceType: 'membership',
        resourceId: `${membership.org_id}:${membership.user_id}`,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger membership.created webhook:', error.message)
    }
  }
  
  /**
   * Trigger membership updated event
   */
  async triggerMembershipUpdated(membership, changes = {}, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        membership: {
          organization_id: membership.org_id,
          user_id: membership.user_id,
          role: membership.role,
          permissions: membership.permissions || [],
          updated_at: new Date().toISOString(),
        },
        changes,
        organization_id: membership.org_id,
        updated_by: options.updatedBy,
      }
      
      return await webhookService.triggerEvent('membership.updated', payload, {
        orgId: membership.org_id,
        triggeredBy: options.updatedBy,
        resourceType: 'membership',
        resourceId: `${membership.org_id}:${membership.user_id}`,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger membership.updated webhook:', error.message)
    }
  }
  
  /**
   * Trigger membership deleted event
   */
  async triggerMembershipDeleted(membership, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        membership: {
          organization_id: membership.org_id,
          user_id: membership.user_id,
          role: membership.role,
          removed_at: new Date().toISOString(),
        },
        organization_id: membership.org_id,
        removed_by: options.removedBy,
      }
      
      return await webhookService.triggerEvent('membership.deleted', payload, {
        orgId: membership.org_id,
        triggeredBy: options.removedBy,
        resourceType: 'membership',
        resourceId: `${membership.org_id}:${membership.user_id}`,
        metadata: {
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger membership.deleted webhook:', error.message)
    }
  }
  
  /**
   * Trigger session created event
   */
  async triggerSessionCreated(session, user, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        session: {
          id: session.jti,
          user_id: session.user_id,
          organization_id: session.org_id,
          device_info: session.device_info || session.deviceInfo,
          ip: session.ip,
          user_agent: session.user_agent || session.userAgent,
          created_at: session.created_at || session.createdAt,
          expires_at: session.expires_at || session.expiresAt,
        },
        user: {
          id: user.id,
          email: user.email,
        },
        organization_id: session.org_id,
        creation_method: options.creationMethod || 'magic_link',
      }
      
      return await webhookService.triggerEvent('session.created', payload, {
        orgId: session.org_id,
        triggeredBy: session.user_id,
        resourceType: 'session',
        resourceId: session.jti,
        metadata: {
          ip: session.ip,
          user_agent: session.user_agent || session.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger session.created webhook:', error.message)
    }
  }
  
  /**
   * Trigger session expired event
   */
  async triggerSessionExpired(session, user, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        session: {
          id: session.jti,
          user_id: session.user_id,
          organization_id: session.org_id,
          expired_at: new Date().toISOString(),
          expiration_reason: options.expirationReason || 'timeout',
        },
        user: {
          id: user.id,
          email: user.email,
        },
        organization_id: session.org_id,
      }
      
      return await webhookService.triggerEvent('session.expired', payload, {
        orgId: session.org_id,
        triggeredBy: session.user_id,
        resourceType: 'session',
        resourceId: session.jti,
        metadata: {
          expiration_reason: options.expirationReason,
        },
      })
    } catch (error) {
      console.error('Failed to trigger session.expired webhook:', error.message)
    }
  }
  
  /**
   * Trigger session revoked event
   */
  async triggerSessionRevoked(session, user, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        session: {
          id: session.jti,
          user_id: session.user_id,
          organization_id: session.org_id,
          revoked_at: new Date().toISOString(),
          revocation_reason: options.revocationReason || 'user_logout',
        },
        user: {
          id: user.id,
          email: user.email,
        },
        organization_id: session.org_id,
        revoked_by: options.revokedBy,
      }
      
      return await webhookService.triggerEvent('session.revoked', payload, {
        orgId: session.org_id,
        triggeredBy: options.revokedBy || session.user_id,
        resourceType: 'session',
        resourceId: session.jti,
        metadata: {
          revocation_reason: options.revocationReason,
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger session.revoked webhook:', error.message)
    }
  }
  
  /**
   * Trigger suspicious activity event
   */
  async triggerSuspiciousActivity(user, activity, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
        },
        activity: {
          type: activity.type,
          description: activity.description,
          risk_score: activity.risk_score || activity.riskScore,
          patterns: activity.patterns || [],
          ip: activity.ip,
          user_agent: activity.user_agent || activity.userAgent,
          location: activity.location,
          detected_at: activity.detected_at || new Date().toISOString(),
        },
        organization_id: options.orgId,
        severity: activity.severity || 'medium',
      }
      
      return await webhookService.triggerEvent('security.suspicious_activity', payload, {
        orgId: options.orgId,
        triggeredBy: null, // System generated
        resourceType: 'security_event',
        resourceId: activity.id || `suspicious_activity_${Date.now()}`,
        metadata: {
          ip: activity.ip,
          user_agent: activity.user_agent || activity.userAgent,
          risk_score: activity.risk_score || activity.riskScore,
        },
      })
    } catch (error) {
      console.error('Failed to trigger security.suspicious_activity webhook:', error.message)
    }
  }
  
  /**
   * Trigger security breach detected event
   */
  async triggerSecurityBreach(breach, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        breach: {
          id: breach.id,
          type: breach.type,
          description: breach.description,
          severity: breach.severity || 'critical',
          affected_users: breach.affected_users || [],
          detected_at: breach.detected_at || new Date().toISOString(),
          source: breach.source,
          indicators: breach.indicators || [],
        },
        organization_id: options.orgId,
        response_actions: breach.response_actions || [],
      }
      
      return await webhookService.triggerEvent('security.breach_detected', payload, {
        orgId: options.orgId,
        triggeredBy: null, // System generated
        resourceType: 'security_event',
        resourceId: breach.id,
        metadata: {
          severity: breach.severity,
          affected_count: breach.affected_users?.length || 0,
        },
      })
    } catch (error) {
      console.error('Failed to trigger security.breach_detected webhook:', error.message)
    }
  }
  
  /**
   * Trigger new device login event
   */
  async triggerNewDeviceLogin(user, session, deviceInfo, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
        },
        session: {
          id: session.jti,
          ip: session.ip,
          user_agent: session.user_agent || session.userAgent,
          created_at: session.created_at || session.createdAt,
        },
        device: {
          fingerprint: deviceInfo.fingerprint || deviceInfo.stableFingerprint,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device_type: deviceInfo.device_type || deviceInfo.deviceType,
          is_mobile: deviceInfo.is_mobile || deviceInfo.isMobile,
        },
        location: options.location,
        organization_id: options.orgId,
      }
      
      return await webhookService.triggerEvent('security.new_device_login', payload, {
        orgId: options.orgId,
        triggeredBy: user.id,
        resourceType: 'security_event',
        resourceId: `new_device_${session.jti}`,
        metadata: {
          ip: session.ip,
          user_agent: session.user_agent || session.userAgent,
          device_fingerprint: deviceInfo.fingerprint || deviceInfo.stableFingerprint,
        },
      })
    } catch (error) {
      console.error('Failed to trigger security.new_device_login webhook:', error.message)
    }
  }
  
  /**
   * Trigger impossible travel event
   */
  async triggerImpossibleTravel(user, travelData, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
        },
        travel: {
          previous_location: travelData.previous_location || travelData.previousLocation,
          current_location: travelData.current_location || travelData.currentLocation,
          distance_km: travelData.distance_km || travelData.distanceKm,
          time_difference_hours: travelData.time_difference_hours || travelData.timeDifferenceHours,
          max_possible_speed_kmh: travelData.max_possible_speed_kmh || travelData.maxPossibleSpeedKmh,
          detected_at: travelData.detected_at || new Date().toISOString(),
        },
        organization_id: options.orgId,
        risk_score: travelData.risk_score || travelData.riskScore || 100,
      }
      
      return await webhookService.triggerEvent('security.impossible_travel', payload, {
        orgId: options.orgId,
        triggeredBy: user.id,
        resourceType: 'security_event',
        resourceId: `impossible_travel_${user.id}_${Date.now()}`,
        metadata: {
          distance_km: travelData.distance_km || travelData.distanceKm,
          time_difference_hours: travelData.time_difference_hours || travelData.timeDifferenceHours,
          risk_score: travelData.risk_score || travelData.riskScore,
        },
      })
    } catch (error) {
      console.error('Failed to trigger security.impossible_travel webhook:', error.message)
    }
  }
  
  /**
   * Trigger account takeover event
   */
  async triggerAccountTakeover(user, takeoverData, options = {}) {
    if (!this.enabled) return
    
    try {
      const payload = {
        user: {
          id: user.id,
          email: user.email,
        },
        takeover: {
          risk_score: takeoverData.risk_score || takeoverData.riskScore,
          risk_factors: takeoverData.risk_factors || takeoverData.riskFactors || [],
          indicators: takeoverData.indicators || [],
          confidence: takeoverData.confidence || 'high',
          detected_at: takeoverData.detected_at || new Date().toISOString(),
        },
        organization_id: options.orgId,
        automated_actions: takeoverData.automated_actions || [],
      }
      
      return await webhookService.triggerEvent('security.account_takeover', payload, {
        orgId: options.orgId,
        triggeredBy: null, // System generated
        resourceType: 'security_event',
        resourceId: `account_takeover_${user.id}_${Date.now()}`,
        metadata: {
          risk_score: takeoverData.risk_score || takeoverData.riskScore,
          confidence: takeoverData.confidence,
          ip: options.ip,
          user_agent: options.userAgent,
        },
      })
    } catch (error) {
      console.error('Failed to trigger security.account_takeover webhook:', error.message)
    }
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      webhook_service_status: this.enabled ? 'active' : 'disabled',
    }
  }
}

// Create singleton instance
const webhookEventsService = new WebhookEventsService()

// Export singleton and class
export default webhookEventsService
