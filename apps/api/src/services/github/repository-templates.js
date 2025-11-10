/**
 * Repository Templates Service
 *
 * Service for managing GitHub repository templates and creating repositories from templates.
 *
 * Features:
 * - List available repository templates
 * - Create repositories from templates
 * - Configure repository settings
 * - Initialize with custom content
 *
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-using-a-template
 */

import GitHubClient from './github-client.js';
import { GitHubAPIError } from './github-client.js';

/**
 * Repository Templates Service
 */
export class RepositoryTemplatesService {
  constructor(options = {}) {
    this.githubClient = options.githubClient;
    this.logger = options.logger || console;
    
    if (!this.githubClient) {
      throw new Error('GitHubClient is required');
    }
  }

  /**
   * List repository templates for a user/organization
   *
   * @param {string} owner - Repository owner (user or org)
   * @returns {Promise<Array>} List of template repositories
   */
  async listTemplates(owner) {
    try {
      // Get all repositories for the owner
      const queryParams = new URLSearchParams({
        type: 'all',
        per_page: '100',
        sort: 'updated'
      });
      const repos = await this.githubClient.request(`/users/${owner}/repos?${queryParams.toString()}`);

      // Filter repositories that are templates
      // GitHub marks templates with is_template: true
      return repos.filter(repo => repo.is_template === true);
    } catch (error) {
      this.logger.error('Failed to list templates', { owner, error: error.message });
      throw error;
    }
  }

  /**
   * Get template repository details
   *
   * @param {string} owner - Template owner
   * @param {string} templateRepo - Template repository name
   * @returns {Promise<Object>} Template repository details
   */
  async getTemplate(owner, templateRepo) {
    try {
      const repo = await this.githubClient.getRepository(owner, templateRepo);
      
      if (!repo.is_template) {
        throw new Error(`Repository ${owner}/${templateRepo} is not a template`);
      }

      return repo;
    } catch (error) {
      this.logger.error('Failed to get template', { owner, templateRepo, error: error.message });
      throw error;
    }
  }

  /**
   * Create repository from template
   *
   * @param {string} templateOwner - Template owner
   * @param {string} templateRepo - Template repository name
   * @param {Object} options - Repository creation options
   * @param {string} options.name - New repository name (required)
   * @param {string} options.owner - Owner of new repository (user or org, defaults to authenticated user)
   * @param {string} options.description - Repository description
   * @param {boolean} options.private - Make repository private (default: false)
   * @param {boolean} options.include_all_branches - Include all branches (default: false)
   * @returns {Promise<Object>} Created repository
   */
  async createFromTemplate(templateOwner, templateRepo, options = {}) {
    if (!options.name) {
      throw new Error('Repository name is required');
    }

    try {
      const endpoint = `/repos/${templateOwner}/${templateRepo}/generate`;
      
      const body = {
        name: options.name,
        owner: options.owner || null,
        description: options.description || null,
        private: options.private === true,
        include_all_branches: options.include_all_branches === true
      };

      // Remove null values
      Object.keys(body).forEach(key => {
        if (body[key] === null) {
          delete body[key];
        }
      });

      const response = await this.githubClient.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create repository from template', {
        templateOwner,
        templateRepo,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get default files from a template
   *
   * @param {string} owner - Template owner
   * @param {string} repo - Template repository name
   * @param {string} ref - Git reference (branch/tag, default: default branch)
   * @returns {Promise<Array>} List of files in template
   */
  async getTemplateFiles(owner, repo, ref = null) {
    try {
      // Get repository to find default branch
      const repository = await this.githubClient.getRepository(owner, repo);
      const branch = ref || repository.default_branch;

      // Get repository contents (root directory)
      const queryParams = new URLSearchParams();
      if (branch) queryParams.set('ref', branch);
      const query = queryParams.toString();
      const contents = await this.githubClient.request(
        `/repos/${owner}/${repo}/contents${query ? `?${query}` : ''}`
      );

      // Filter out directories and return file list
      return contents
        .filter(item => item.type === 'file')
        .map(item => ({
          path: item.path,
          name: item.name,
          size: item.size,
          sha: item.sha,
          download_url: item.download_url,
          type: item.type
        }));
    } catch (error) {
      this.logger.error('Failed to get template files', {
        owner,
        repo,
        ref,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get template README content
   *
   * @param {string} owner - Template owner
   * @param {string} repo - Template repository name
   * @returns {Promise<string|null>} README content or null if not found
   */
  async getTemplateReadme(owner, repo) {
    try {
      const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
      
      for (const filename of readmeFiles) {
        try {
          const file = await this.githubClient.request(
            `/repos/${owner}/${repo}/contents/${filename}`
          );
          
          // Decode base64 content
          if (file.content) {
            return Buffer.from(file.content, 'base64').toString('utf-8');
          }
        } catch {
          // File not found, continue to next
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get template README', {
        owner,
        repo,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Validate template availability
   *
   * @param {string} owner - Template owner
   * @param {string} repo - Template repository name
   * @returns {Promise<boolean>} True if template is available
   */
  async validateTemplate(owner, repo) {
    try {
      const repository = await this.githubClient.getRepository(owner, repo);
      return repository.is_template === true;
    } catch (error) {
      return false;
    }
  }
}

export default RepositoryTemplatesService;

