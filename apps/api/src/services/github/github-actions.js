/**
 * GitHub Actions Service
 *
 * Service for managing GitHub Actions workflows, runs, and secrets.
 *
 * Features:
 * - Trigger workflows from Truxe
 * - Monitor workflow runs
 * - Access workflow logs
 * - Manage workflow secrets
 *
 * @see https://docs.github.com/en/rest/actions
 */

import GitHubClient from './github-client.js';
import { GitHubAPIError } from './github-client.js';

export class GitHubActionsService {
  constructor(options = {}) {
    this.githubClient = options.githubClient;
    this.logger = options.logger || console;
    this.pool = options.pool;

    if (!this.githubClient) {
      throw new Error('GitHubClient is required');
    }
  }

  /**
   * List workflows for a repository
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of workflows
   */
  async listWorkflows(owner, repo) {
    try {
      return await this.githubClient.request(`/repos/${owner}/${repo}/actions/workflows`);
    } catch (error) {
      this.logger.error('Failed to list workflows', { owner, repo, error: error.message });
      throw error;
    }
  }

  /**
   * Get workflow details
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number|string} workflowId - Workflow ID or filename
   * @returns {Promise<Object>} Workflow details
   */
  async getWorkflow(owner, repo, workflowId) {
    try {
      return await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/workflows/${workflowId}`
      );
    } catch (error) {
      this.logger.error('Failed to get workflow', { owner, repo, workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Trigger a workflow dispatch
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number|string} workflowId - Workflow ID or filename
   * @param {Object} options - Dispatch options
   * @param {string} options.ref - Git reference (branch/tag)
   * @param {Object} options.inputs - Workflow inputs
   * @returns {Promise<void>}
   */
  async triggerWorkflow(owner, repo, workflowId, options = {}) {
    if (!options.ref) {
      throw new Error('Git reference (ref) is required');
    }

    try {
      const body = {
        ref: options.ref,
        ...(options.inputs && { inputs: options.inputs })
      };

      await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
        {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to trigger workflow', {
        owner,
        repo,
        workflowId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List workflow runs
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @param {number|string} options.workflowId - Filter by workflow ID
   * @param {string} options.actor - Filter by actor
   * @param {string} options.branch - Filter by branch
   * @param {string} options.event - Filter by event
   * @param {string} options.status - Filter by status
   * @param {number} options.perPage - Results per page
   * @param {number} options.page - Page number
   * @returns {Promise<Object>} Workflow runs with pagination
   */
  async listWorkflowRuns(owner, repo, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (options.workflowId) queryParams.set('workflow_id', String(options.workflowId));
      if (options.actor) queryParams.set('actor', options.actor);
      if (options.branch) queryParams.set('branch', options.branch);
      if (options.event) queryParams.set('event', options.event);
      if (options.status) queryParams.set('status', options.status);
      if (options.perPage) queryParams.set('per_page', String(options.perPage));
      if (options.page) queryParams.set('page', String(options.page));

      const query = queryParams.toString();
      return await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/runs${query ? `?${query}` : ''}`
      );
    } catch (error) {
      this.logger.error('Failed to list workflow runs', { owner, repo, options, error: error.message });
      throw error;
    }
  }

  /**
   * Get workflow run details
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   * @returns {Promise<Object>} Workflow run details
   */
  async getWorkflowRun(owner, repo, runId) {
    try {
      return await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/runs/${runId}`
      );
    } catch (error) {
      this.logger.error('Failed to get workflow run', { owner, repo, runId, error: error.message });
      throw error;
    }
  }

  /**
   * Get workflow run jobs
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   * @returns {Promise<Object>} Jobs with pagination
   */
  async getWorkflowRunJobs(owner, repo, runId) {
    try {
      return await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
      );
    } catch (error) {
      this.logger.error('Failed to get workflow run jobs', { owner, repo, runId, error: error.message });
      throw error;
    }
  }

  /**
   * Get workflow run logs
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   * @returns {Promise<string>} Logs archive URL
   */
  async getWorkflowRunLogs(owner, repo, runId) {
    try {
      // GitHub returns a redirect (302) to a signed URL for the logs archive
      // We return the URL for the client to download
      const response = await fetch(
        `${this.githubClient.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.githubClient.accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': this.githubClient.apiVersion,
            'User-Agent': this.githubClient.userAgent
          },
          redirect: 'manual' // Don't follow redirect, get the URL
        }
      );

      if (response.status === 302 || response.status === 200) {
        const location = response.headers.get('Location');
        if (location) {
          return { url: location };
        }
      }

      // Fallback: return empty if logs not available
      if (response.status === 204) {
        return { url: null, message: 'Logs not available or expired' };
      }

      throw new GitHubAPIError(
        `Failed to get workflow logs: ${response.statusText}`,
        { statusCode: response.status }
      );
    } catch (error) {
      this.logger.error('Failed to get workflow run logs', { owner, repo, runId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel workflow run
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   * @returns {Promise<void>}
   */
  async cancelWorkflowRun(owner, repo, runId) {
    try {
      await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
        {
          method: 'POST'
        }
      );
    } catch (error) {
      this.logger.error('Failed to cancel workflow run', { owner, repo, runId, error: error.message });
      throw error;
    }
  }

  /**
   * List repository secrets
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Secrets (names only, values are never exposed)
   */
  async listSecrets(owner, repo) {
    try {
      return await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/secrets`
      );
    } catch (error) {
      this.logger.error('Failed to list secrets', { owner, repo, error: error.message });
      throw error;
    }
  }

  /**
   * Get public key for encrypting secrets
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Public key for encryption
   */
  async getPublicKey(owner, repo) {
    try {
      return await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/secrets/public-key`
      );
    } catch (error) {
      this.logger.error('Failed to get public key', { owner, repo, error: error.message });
      throw error;
    }
  }

  /**
   * Create or update secret
   * Note: Secret value must be encrypted using the repository's public key
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} secretName - Secret name
   * @param {string} encryptedValue - Encrypted secret value
   * @param {number[]} selectedRepositoryIds - Repository IDs if restricting to specific repos
   * @returns {Promise<void>}
   */
  async createOrUpdateSecret(owner, repo, secretName, encryptedValue, selectedRepositoryIds = null) {
    try {
      const body = {
        encrypted_value: encryptedValue,
        key_id: (await this.getPublicKey(owner, repo)).key_id,
        ...(selectedRepositoryIds && { selected_repository_ids: selectedRepositoryIds })
      };

      await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/secrets/${secretName}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to create/update secret', {
        owner,
        repo,
        secretName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete secret
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} secretName - Secret name
   * @returns {Promise<void>}
   */
  async deleteSecret(owner, repo, secretName) {
    try {
      await this.githubClient.request(
        `/repos/${owner}/${repo}/actions/secrets/${secretName}`,
        {
          method: 'DELETE'
        }
      );
    } catch (error) {
      this.logger.error('Failed to delete secret', { owner, repo, secretName, error: error.message });
      throw error;
    }
  }

  /**
   * Store workflow run in database for tracking
   *
   * @param {Object} runData - Workflow run data from GitHub
   * @param {string} repositoryId - Truxe repository ID (optional)
   * @returns {Promise<Object>} Stored run
   */
  async storeWorkflowRun(runData, repositoryId = null) {
    if (!this.pool) {
      this.logger.warn('Database pool not available, skipping workflow run storage');
      return runData;
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO github_workflow_runs (
          workflow_run_id, repository_owner, repository_name, workflow_id,
          workflow_name, status, conclusion, event, actor, head_branch,
          head_sha, workflow_url, repository_id, github_created_at, github_updated_at,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        ON CONFLICT (workflow_run_id) DO UPDATE SET
          status = EXCLUDED.status,
          conclusion = EXCLUDED.conclusion,
          workflow_url = EXCLUDED.workflow_url,
          github_updated_at = EXCLUDED.github_updated_at,
          updated_at = NOW()
        RETURNING *`,
        [
          runData.id,
          runData.repository.owner.login,
          runData.repository.name,
          runData.workflow_id,
          runData.name || null,
          runData.status,
          runData.conclusion || null,
          runData.event,
          runData.actor?.login || null,
          runData.head_branch,
          runData.head_sha,
          runData.html_url || null,
          repositoryId,
          new Date(runData.created_at),
          new Date(runData.updated_at)
        ]
      );

      return this.formatWorkflowRun(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Format workflow run row from database
   *
   * @param {Object} row - Database row
   * @returns {Object} Formatted workflow run
   * @private
   */
  formatWorkflowRun(row) {
    return {
      id: row.id,
      workflow_run_id: row.workflow_run_id,
      repository_owner: row.repository_owner,
      repository_name: row.repository_name,
      workflow_id: row.workflow_id,
      workflow_name: row.workflow_name,
      status: row.status,
      conclusion: row.conclusion,
      event: row.event,
      actor: row.actor,
      head_branch: row.head_branch,
      head_sha: row.head_sha,
      workflow_url: row.workflow_url,
      repository_id: row.repository_id,
      github_created_at: row.github_created_at?.toISOString(),
      github_updated_at: row.github_updated_at?.toISOString(),
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString()
    };
  }
}

export default GitHubActionsService;

