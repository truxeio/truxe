/**
 * Organization and RBAC types for Truxe multi-tenancy
 */

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'guest';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
  invited_by?: string | null;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export interface RolePermission {
  role: OrganizationRole;
  permission_id: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  website?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  logo_url?: string;
  website?: string;
}

export interface InviteMemberInput {
  email: string;
  role: OrganizationRole;
}
