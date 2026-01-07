<script setup lang="ts">
import { ref, onMounted, reactive } from "vue";
import { ElMessage } from "element-plus";
import { getPermissions, getRoles } from "@/api/permission";
import type {
  Permission,
  Role,
  PermissionListResult,
  RoleListResult
} from "@/api/permission";

defineOptions({
  name: "PermissionPage"
});

// 权限列表数据
const permissions = ref<Permission[]>([]);
const permissionTotal = ref(0);
const permissionPage = ref(1);
const permissionPageSize = ref(10);
const permissionSearch = ref("");

// 角色列表数据
const roles = ref<Role[]>([]);
const roleTotal = ref(0);
const rolePage = ref(1);
const rolePageSize = ref(10);
const roleSearch = ref("");

// 加载状态
const loading = reactive({
  permissions: false,
  roles: false
});

// 获取权限列表
const fetchPermissions = async () => {
  loading.permissions = true;
  try {
    const res = await getPermissions({
      page: permissionPage.value,
      pageSize: permissionPageSize.value,
      search: permissionSearch.value
    });
    console.log("权限API响应:", res);
    if (res) {
      permissions.value = res.permissions || [];
      permissionTotal.value = res.totalCount || 0;
    } else {
      permissions.value = [];
      permissionTotal.value = 0;
    }
  } catch (error) {
    ElMessage.error("获取权限列表失败");
    console.error("获取权限列表失败:", error);
    permissions.value = [];
    permissionTotal.value = 0;
  } finally {
    loading.permissions = false;
  }
};

// 获取角色列表
const fetchRoles = async () => {
  loading.roles = true;
  try {
    const res = await getRoles({
      page: rolePage.value,
      pageSize: rolePageSize.value,
      search: roleSearch.value
    });
    console.log("角色API响应:", res);
    if (res) {
      roles.value = res.roles || [];
      roleTotal.value = res.totalCount || 0;
    } else {
      roles.value = [];
      roleTotal.value = 0;
    }
  } catch (error) {
    ElMessage.error("获取角色列表失败");
    console.error("获取角色列表失败:", error);
    roles.value = [];
    roleTotal.value = 0;
  } finally {
    loading.roles = false;
  }
};

// 页面加载时获取数据
onMounted(() => {
  fetchPermissions();
  fetchRoles();
});
</script>

<template>
  <div class="permission-container">
    <h2 class="mb-4">权限管理</h2>

    <!-- 权限列表 -->
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>权限列表</span>
          <el-button type="primary" size="small" @click="fetchPermissions"
            >刷新</el-button
          >
        </div>
      </template>

      <el-table
        v-loading="loading.permissions"
        :data="permissions"
        style="width: 100%"
        border
      >
        <el-table-column prop="code" label="权限编码" width="180" />
        <el-table-column prop="name" label="权限名称" width="180" />
        <el-table-column prop="description" label="权限描述" />
        <el-table-column prop="createdAt" label="创建时间" width="200" />
        <el-table-column prop="lastModifiedAt" label="更新时间" width="200" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default>
            <el-button type="primary" size="small" plain>编辑</el-button>
            <el-button type="danger" size="small" plain>删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="permissionPage"
        v-model:page-size="permissionPageSize"
        :total="permissionTotal"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        class="mt-3"
        @size-change="fetchPermissions"
        @current-change="fetchPermissions"
      />
    </el-card>

    <!-- 角色列表 -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>角色列表</span>
          <el-button type="primary" size="small" @click="fetchRoles"
            >刷新</el-button
          >
        </div>
      </template>

      <el-table
        v-loading="loading.roles"
        :data="roles"
        style="width: 100%"
        border
      >
        <el-table-column prop="code" label="角色编码" width="180" />
        <el-table-column prop="name" label="角色名称" width="180" />
        <el-table-column label="拥有权限" width="250">
          <template #default="scope">
            <el-tag
              v-for="permission in scope.row.permissions"
              :key="permission"
              size="small"
              class="mr-1 mb-1"
            >
              {{ permission }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="200" />
        <el-table-column prop="lastModifiedAt" label="更新时间" width="200" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default>
            <el-button type="primary" size="small" plain>编辑</el-button>
            <el-button type="success" size="small" plain>分配权限</el-button>
            <el-button type="danger" size="small" plain>删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="rolePage"
        v-model:page-size="rolePageSize"
        :total="roleTotal"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        class="mt-3"
        @size-change="fetchRoles"
        @current-change="fetchRoles"
      />
    </el-card>
  </div>
</template>

<style scoped>
.permission-container {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
