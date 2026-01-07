import { http } from "@/utils/http";

// 权限管理API

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  createdAt: string;
  lastModifiedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  lastModifiedAt?: string;
  permissions: string[];
}

export interface UserRole {
  userId: string;
  roleIds: string[];
}

export interface RolePermission {
  roleId: string;
  permissionIds: string[];
}

export interface PermissionListResult {
  totalCount: number;
  page: number;
  pageSize: number;
  permissions: Permission[];
}

export interface RoleListResult {
  totalCount: number;
  page: number;
  pageSize: number;
  roles: Role[];
}

// 权限相关API
export const getPermissions = (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) => {
  return http.request<PermissionListResult>("get", "/api/permission", {
    params
  });
};

export const createPermission = (data: {
  code: string;
  name: string;
  description: string;
}) => {
  return http.request<{ id: string }>("post", "/api/permission", { data });
};

export const updatePermission = (
  id: string,
  data: { code: string; name: string; description: string }
) => {
  return http.request("put", `/api/permission/${id}`, { data });
};

export const deletePermission = (id: string) => {
  return http.request("delete", `/api/permission/${id}`);
};

// 角色相关API
export const getRoles = (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) => {
  return http.request<RoleListResult>("get", "/api/role", { params });
};

export const createRole = (data: {
  name: string;
  code: string;
  permissionCodes?: string[];
}) => {
  return http.request<{ id: string }>("post", "/api/role", { data });
};

export const updateRole = (
  id: string,
  data: { name: string; code: string }
) => {
  return http.request("put", `/api/role/${id}`, { data });
};

export const deleteRole = (id: string) => {
  return http.request("delete", `/api/role/${id}`);
};

// 用户角色分配
export const assignUserRoles = (
  userId: string,
  data: { roleIds: string[] }
) => {
  return http.request("put", `/api/user/${userId}/roles`, { data });
};

// 角色权限分配
export const assignRolePermissions = (
  roleId: string,
  data: { permissionIds: string[] }
) => {
  return http.request("put", `/api/role/${roleId}/permissions`, { data });
};
