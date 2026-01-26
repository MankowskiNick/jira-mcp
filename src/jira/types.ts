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
