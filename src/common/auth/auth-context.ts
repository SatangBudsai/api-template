export interface AuthAccount {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface AuthContext extends AuthAccount {
  sessionId: string;
  accessVersion: number;
}

export interface RequestWithAuth {
  auth?: AuthContext;
}
