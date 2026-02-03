// Type definitions for JIRA responses

export type JiraCreateResponse = {
  errorMessages?: string[];
  errors?: Record<string, string>;
  key?: string;
  id?: string;
};

export type JiraGetResponse = {
  errorMessages?: string[];
  id?: string; // Internal Jira ID
  fields?: {
    summary: string;
    description?: any;
    issuetype: {
      name: string;
    };
    status?: {
      name: string;
    };
    priority?: {
      name: string;
    };
    [key: string]: any; // Allow for custom fields
  };
  [key: string]: any;
};

export type JiraSearchResponse = {
  errorMessages?: string[];
  issues?: Array<{
    key: string;
    fields: {
      summary: string;
      description?: any;
      issuetype: {
        name: string;
      };
      status?: {
        name: string;
      };
      priority?: {
        name: string;
      };
      [key: string]: any; // Allow for custom fields
    };
  }>;
  total?: number;
  maxResults?: number;
  startAt?: number;
};

// Comment types
export type JiraCommentResponse = {
  errorMessages?: string[];
  errors?: Record<string, string>;
  id?: string;
  body?: any;
  author?: { accountId: string; displayName: string };
  created?: string;
};

export type JiraComment = {
  id: string;
  body: any;
  author: { accountId: string; displayName: string };
  created: string;
  updated: string;
};

export type JiraCommentsListResponse = {
  errorMessages?: string[];
  comments?: JiraComment[];
  total?: number;
};

// Transition types
export type JiraTransition = {
  id: string;
  name: string;
  to: { id: string; name: string };
};

export type JiraTransitionsResponse = {
  errorMessages?: string[];
  transitions?: JiraTransition[];
};
