# CAD CAM 3D under Quản trị Ứng dụng

`CAD_CAM_3D` is registered as a level-1 client under the central control-plane.

The central admin surface follows the same approved-management-device gate and workspace shell used by other managed applications. The first management surfaces are:

- runtime/connection overview;
- interface policy and feature flags;
- dedicated CAD device boundary (`CAD-` namespace);
- print-policy rollout;
- safe operational audit metadata;
- management-contract readiness.

## Current gate

The CAD repository already publishes its management contract and typed policy seam. The remote CAD Control API, signed device/session flow and production Site are not available yet, therefore remote mutation controls remain intentionally disabled.

No CAD project, geometry body, mesh payload or exported STL/STEP/3MF file may be copied into Application Management. The control-plane coordinates permissions and policy; CAD_CAM_3D owns engineering data.
