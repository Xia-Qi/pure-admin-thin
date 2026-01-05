import oauthConfig from "@/config/oauth";
import { isString } from "@pureadmin/utils";

export interface OAuthState {
  state: string;
  timestamp: number;
}

export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function saveState(state: string): void {
  const oauthState: OAuthState = {
    state,
    timestamp: Date.now()
  };
  sessionStorage.setItem("oauth_state", JSON.stringify(oauthState));
}

export function getState(): OAuthState | null {
  const stateStr = sessionStorage.getItem("oauth_state");
  if (!stateStr) return null;
  
  try {
    const state = JSON.parse(stateStr) as OAuthState;
    return state;
  } catch {
    return null;
  }
}

export function removeState(): void {
  sessionStorage.removeItem("oauth_state");
}

export function validateState(state: string): boolean {
  const savedState = getState();
  if (!savedState) return false;
  
  const isValid = savedState.state === state;
  const isExpired = Date.now() - savedState.timestamp > 5 * 60 * 1000;
  
  if (isValid && !isExpired) {
    removeState();
    return true;
  }
  
  removeState();
  return false;
}

export function buildAuthorizationUrl(redirectUri?: string): string {
  const state = generateState();
  saveState(state);
  
  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: redirectUri || oauthConfig.redirectUri,
    response_type: oauthConfig.responseType,
    scope: oauthConfig.scopes.join(" "),
    state: state
  });
  
  return `${oauthConfig.serverUrl}/connect/authorize?${params.toString()}`;
}

export function parseCallbackUrl(url: string): {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
} {
  const params = new URLSearchParams(url.split("?")[1]);
  
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
    errorDescription: params.get("error_description")
  };
}

export function isOAuthCallback(url: string): boolean {
  const params = parseCallbackUrl(url);
  return !!(params.code || params.error);
}

export function clearOAuthSession(): void {
  removeState();
}