-- ===================================================================
-- PERFORMANCE VALIDATION SCRIPT
-- ===================================================================

-- Create test users
INSERT INTO users (email) VALUES 
  ('user1@test.com'),
  ('user2@test.com'),
  ('user3@test.com'),
  ('admin@test.com'),
  ('manager@test.com');

-- Get user IDs for later reference
DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  admin_id UUID;
  workspace_id UUID;
  team_id UUID;
  project_id UUID;
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  -- Get user IDs
  SELECT id INTO user1_id FROM users WHERE email = 'user1@test.com';
  SELECT id INTO user2_id FROM users WHERE email = 'user2@test.com';
  SELECT id INTO admin_id FROM users WHERE email = 'admin@test.com';

  RAISE NOTICE '🚀 Starting Performance Tests...';
  
  -- Test 1: Create hierarchy (should be < 50ms)
  start_time := clock_timestamp();
  
  -- Create workspace
  INSERT INTO tenants (name, slug, tenant_type, max_depth) 
  VALUES ('Acme Corp', 'acme-corp', 'workspace', 3) 
  RETURNING id INTO workspace_id;
  
  -- Create team
  INSERT INTO tenants (parent_tenant_id, name, slug, tenant_type) 
  VALUES (workspace_id, 'Engineering', 'engineering', 'team') 
  RETURNING id INTO team_id;
  
  -- Create project
  INSERT INTO tenants (parent_tenant_id, name, slug, tenant_type) 
  VALUES (team_id, 'Mobile App', 'mobile-app', 'project') 
  RETURNING id INTO project_id;
  
  end_time := clock_timestamp();
  RAISE NOTICE '✅ Hierarchy Creation: % ms', EXTRACT(MILLISECONDS FROM (end_time - start_time));

  -- Test 2: Path-based queries (should be < 100ms)
  start_time := clock_timestamp();
  
  -- Query all descendants of workspace
  PERFORM COUNT(*) FROM tenants WHERE path @> ARRAY[workspace_id];
  
  -- Query all ancestors of project
  PERFORM COUNT(*) FROM tenants WHERE project_id = ANY(path);
  
  end_time := clock_timestamp();
  RAISE NOTICE '✅ Path Queries: % ms', EXTRACT(MILLISECONDS FROM (end_time - start_time));

  -- Test 3: Member operations (should be < 50ms)
  start_time := clock_timestamp();
  
  -- Add members to tenants
  INSERT INTO tenant_members (tenant_id, user_id, role, joined_at) VALUES
    (workspace_id, admin_id, 'admin', NOW()),
    (workspace_id, user1_id, 'member', NOW()),
    (team_id, user1_id, 'admin', NOW()),
    (team_id, user2_id, 'member', NOW()),
    (project_id, user2_id, 'admin', NOW());
  
  end_time := clock_timestamp();
  RAISE NOTICE '✅ Member Operations: % ms', EXTRACT(MILLISECONDS FROM (end_time - start_time));

  -- Test 4: Permission queries (should be < 20ms)
  start_time := clock_timestamp();
  
  -- Add permissions
  INSERT INTO permissions (user_id, tenant_id, resource_type, actions) VALUES
    (admin_id, workspace_id, 'settings', ARRAY['read', 'write', 'admin']),
    (user1_id, team_id, 'project', ARRAY['read', 'write']),
    (user2_id, project_id, 'integration', ARRAY['read']);
  
  -- Query user permissions
  PERFORM COUNT(*) FROM permissions p 
  JOIN tenants t ON p.tenant_id = t.id 
  WHERE p.user_id = user1_id;
  
  end_time := clock_timestamp();
  RAISE NOTICE '✅ Permission Operations: % ms', EXTRACT(MILLISECONDS FROM (end_time - start_time));

  -- Test 5: Complex hierarchy query (should be < 200ms)
  start_time := clock_timestamp();
  
  -- Get user access across hierarchy
  PERFORM t.id, t.name, t.level, tm.role
  FROM tenants t
  LEFT JOIN tenant_members tm ON t.id = tm.tenant_id AND tm.user_id = user1_id
  WHERE t.path @> ARRAY[workspace_id]
  ORDER BY t.level, t.name;
  
  end_time := clock_timestamp();
  RAISE NOTICE '✅ Complex Hierarchy Query: % ms', EXTRACT(MILLISECONDS FROM (end_time - start_time));

  RAISE NOTICE '🎯 Performance Tests Completed!';
  
  -- Display results
  RAISE NOTICE '📊 Test Results:';
  RAISE NOTICE '   • Created % level hierarchy', (SELECT MAX(level) + 1 FROM tenants);
  RAISE NOTICE '   • Total tenants: %', (SELECT COUNT(*) FROM tenants);
  RAISE NOTICE '   • Total members: %', (SELECT COUNT(*) FROM tenant_members);
  RAISE NOTICE '   • Total permissions: %', (SELECT COUNT(*) FROM permissions);
  
END $$;