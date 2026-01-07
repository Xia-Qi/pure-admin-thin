<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { exchangeCodeForToken, getUserInfo } from "@/api/oauth";
import {
  parseCallbackUrl,
  validateState,
  clearOAuthSession
} from "@/utils/oauth";
import { setToken, removeToken, type DataInfo, userKey } from "@/utils/auth";
import { storageLocal } from "@pureadmin/utils";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";

const router = useRouter();
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const url = window.location.href;
    const {
      code,
      state,
      error: oauthError,
      errorDescription
    } = parseCallbackUrl(url);

    if (oauthError) {
      error.value = errorDescription || oauthError;
      loading.value = false;
      oauthErrorCallBack();
      return;
    }

    if (!code) {
      error.value = "未收到授权码";
      loading.value = false;
      oauthErrorCallBack();
      return;
    }

    if (!state || !validateState(state)) {
      error.value = "State 验证失败，可能存在安全风险";
      loading.value = false;
      oauthErrorCallBack();
      return;
    }

    const tokenResponse = await exchangeCodeForToken({ code });

    const expires = new Date(Date.now() + tokenResponse.expires_in * 1000);

    const tokenData: DataInfo<Date> = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expires: expires
    };

    setToken(tokenData);

    try {
      const userInfo = await getUserInfo();

      useUserStoreHook().SET_AVATAR("");
      useUserStoreHook().SET_USERNAME(userInfo.name);
      useUserStoreHook().SET_NICKNAME(userInfo.name);
      useUserStoreHook().SET_ROLES(userInfo.roles || []);
      useUserStoreHook().SET_PERMS([]);

      storageLocal().setItem(userKey, {
        refreshToken: tokenResponse.refresh_token,
        expires: expires.getTime(),
        avatar: "",
        username: userInfo.name,
        nickname: userInfo.name,
        roles: userInfo.roles || [],
        permissions: []
      });

      await initRouter();

      const topMenu = getTopMenu(true);
      await router.push(topMenu.path);

      message("登录成功", { type: "success" });
    } catch (userInfoError) {
      console.error("获取用户信息失败:", userInfoError);
      error.value = "获取用户信息失败，请重试";
      oauthErrorCallBack();
    }
  } catch (err) {
    console.error("OAuth 回调处理失败:", err);
    error.value = err instanceof Error ? err.message : "登录失败，请重试";
    oauthErrorCallBack();
  } finally {
    loading.value = false;
    clearOAuthSession();
  }
});

const oauthErrorCallBack = () => {
  // 清理登录相关的缓存信息
  removeToken();
  useUserStoreHook().SET_AVATAR("");
  useUserStoreHook().SET_USERNAME("");
  useUserStoreHook().SET_NICKNAME("");
  useUserStoreHook().SET_ROLES([]);
  useUserStoreHook().SET_PERMS([]);
  storageLocal().removeItem(userKey);
};

const handleBackToLogin = () => {
  router.push("/login");
};
</script>

<template>
  <div class="oauth-callback-container">
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="40">
        <Loading />
      </el-icon>
      <p>正在登录，请稍候...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <el-icon :size="60" color="#f56c6c">
        <CircleClose />
      </el-icon>
      <h3>登录失败</h3>
      <p>{{ error }}</p>
      <el-button type="primary" @click="handleBackToLogin">
        返回登录页
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.oauth-callback-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-container,
.error-container {
  min-width: 400px;
  padding: 60px 80px;
  text-align: center;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgb(0 0 0 / 20%);
}

.loading-container p {
  margin-top: 20px;
  font-size: 16px;
  color: #606266;
}

.error-container h3 {
  margin: 20px 0 10px;
  font-size: 24px;
  color: #303133;
}

.error-container p {
  margin-bottom: 30px;
  font-size: 14px;
  line-height: 1.6;
  color: #909399;
}
</style>
