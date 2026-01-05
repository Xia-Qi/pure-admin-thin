import oauthConfig from "@/config/oauth";
import { getToken } from "@/utils/auth";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface UserInfoResponse {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
  roles: string[];
  scope: string;
}

export interface ExchangeCodeForTokenParams {
  code: string;
  redirectUri?: string;
}

export interface RefreshTokenParams {
  refreshToken: string;
}

const oauthServerUrl = import.meta.env.VITE_OAUTH_SERVER_URL || "http://localhost:5700";

async function oauthRequest<T>(
  method: "GET" | "POST",
  url: string,
  data?: string | URLSearchParams,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(`${oauthServerUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers
    },
    body: data
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function exchangeCodeForToken(
  params: ExchangeCodeForTokenParams
): Promise<TokenResponse> {
  const formData = new URLSearchParams({
    grant_type: oauthConfig.grantType,
    code: params.code,
    redirect_uri: params.redirectUri || oauthConfig.redirectUri,
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret
  });

  return oauthRequest<TokenResponse>("POST", "/connect/token", formData.toString());
}

export function refreshToken(
  params: RefreshTokenParams
): Promise<TokenResponse> {
  const formData = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret
  });

  return oauthRequest<TokenResponse>("POST", "/connect/token", formData.toString());
}

export function getUserInfo(): Promise<UserInfoResponse> {
  const tokenData = getToken();
  if (!tokenData || !tokenData.accessToken) {
    throw new Error("No token found");
  }

  return oauthRequest<UserInfoResponse>("GET", "/connect/userinfo", undefined, {
    Authorization: `Bearer ${tokenData.accessToken}`
  });
}

export function revokeToken(token: string): Promise<void> {
  const formData = new URLSearchParams({
    token: token,
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret
  });

  return oauthRequest<void>("POST", "/connect/revocation", formData.toString());
}

export function logout(): Promise<void> {
  return oauthRequest<void>("POST", "/connect/logout");
}