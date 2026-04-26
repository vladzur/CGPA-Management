// uuid-mock.js — CJS stub for uuid@14 (pure ESM) in Jest E2E tests
// StorageService uses uuid only for generating file names, which is mocked in E2E tests.
module.exports = {
  v4: () => 'test-uuid-1234-5678-90ab-cdef01234567',
  v1: () => 'test-uuid-v1',
  v3: () => 'test-uuid-v3',
  v5: () => 'test-uuid-v5',
};
