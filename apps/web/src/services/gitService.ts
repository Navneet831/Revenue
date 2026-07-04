import { ApiClient } from './apiClient';
import { API_ENDPOINTS } from '../constants';

export interface GitCommitEntry {
    hash: string;
    message: string;
    date: string;
    author: string;
}

export interface GitCommitsResponse {
    commits: GitCommitEntry[];
    currentHash: string;
}

/**
 * Domain-driven service layer for Git control actions.
 */
export class GitService {
    private static api = ApiClient.getInstance();

    /**
     * Fetches git commit history and the active hash.
     */
    public static async getCommits(): Promise<GitCommitsResponse> {
        try {
            return await this.api.get<GitCommitsResponse>(API_ENDPOINTS.git.commits);
        } catch (error) {
            console.error('[GitService] Failed to fetch commit history:', error);
            throw error;
        }
    }

    /**
     * Triggers a git checkout command to point the workspace to a different commit.
     */
    public static async checkoutCommit(hash: string): Promise<void> {
        try {
            await this.api.post<void>(API_ENDPOINTS.git.checkout, { hash });
        } catch (error) {
            console.error('[GitService] Checkout request failed:', error);
            throw error;
        }
    }
}
