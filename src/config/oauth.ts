export interface OAuthConfig {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
  responseType: string;
  grantType: string;
}

const oauthConfig: OAuthConfig = {
  serverUrl: import.meta.env.VITE_OAUTH_SERVER_URL || "http://localhost:5700",
  clientId: import.meta.env.VITE_OAUTH_CLIENT_ID || "userManageWebClient",
  clientSecret: import.meta.env.VITE_OAUTH_CLIENT_SECRET || "userManageWebClient-secret",
  redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || "http://localhost:8848/callback",
  postLogoutRedirectUri: import.meta.env.VITE_OAUTH_POST_LOGOUT_REDIRECT_URI || "http://localhost:8848/login",
  scopes: [
    "openid",
    "profile",
    "email",
    "roles",
    "offline_access",
    "ahbapi.user.read",
    "ahbapi.user.write",
    "ahbapi.user.delete"
  ],
  responseType: "code",
  grantType: "authorization_code"
};

export default oauthConfig;