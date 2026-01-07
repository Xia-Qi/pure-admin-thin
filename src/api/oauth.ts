import oauthConfig from "@/config/oauth";
import { getToken, formatToken } from "@/utils/auth";
import { http } from "@/utils/http";

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

export async function exchangeCodeForToken(
  params: ExchangeCodeForTokenParams
): Promise<TokenResponse> {
  const tokenParams = {
    grant_type: oauthConfig.grantType,
    code: params.code,
    redirect_uri: params.redirectUri || oauthConfig.redirectUri,
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret
  };

  return http.oauthToken<TokenResponse>(
    `${oauthConfig.serverUrl}/connect/token`,
    tokenParams
  );
}

export async function refreshToken(params: RefreshTokenParams): Promise<{
  success: boolean;
  data: { accessToken: string; refreshToken: string; expires: Date };
}> {
  const tokenParams = {
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret
  };

  const data = await http.oauthToken<TokenResponse>(
    `${oauthConfig.serverUrl}/connect/token`,
    tokenParams
  );

  // 转换为前端期望的数据格式
  return {
    success: true,
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expires: new Date(Date.now() + data.expires_in * 1000)
    }
  };
}

export async function getUserInfo(): Promise<UserInfoResponse> {
  const tokenData = getToken();
  if (!tokenData || !tokenData.accessToken) {
    throw new Error("No token found");
  }

  return http.get<UserInfoResponse, any>(
    `${oauthConfig.serverUrl}/connect/userinfo`,
    {
      headers: {
        Authorization: formatToken(tokenData.accessToken)
      }
    }
  );
}

export async function revokeToken(token: string): Promise<void> {
  const tokenParams = {
    token: token,
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret
  };

  return http.oauthToken<void>(
    `${oauthConfig.serverUrl}/connect/revocation`,
    tokenParams
  );
}

export async function logout(idToken?: string): Promise<void> {
  const params = new URLSearchParams();
  if (idToken) {
    params.append("id_token_hint", idToken);
  }
  //params.append("post_logout_redirect_uri", window.location.origin);

  return http.post<void, any>(`${oauthConfig.serverUrl}/connect/logout`, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    data: params.toString()
  });
}
