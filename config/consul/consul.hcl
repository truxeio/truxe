# Consul Configuration for Heimdall Service Discovery
# Environment: Development/Staging/Production

datacenter = "heimdall"
data_dir = "/consul/data"
log_level = "INFO"
server = true
bootstrap_expect = 1

# Network configuration
bind_addr = "0.0.0.0"
client_addr = "0.0.0.0"

# UI configuration
ui_config {
  enabled = true
}

# Connect configuration for service mesh
connect {
  enabled = true
}

# Performance tuning
performance {
  raft_multiplier = 1
}

# Logging configuration
log_rotate_duration = "24h"
log_rotate_max_files = 7

# Health check configuration
check_update_interval = "5m"

# Service definitions
services {
  name = "heimdall-api"
  port = 3001
  tags = ["api", "backend", "core"]
  
  check {
    http = "http://api:3001/health/ready"
    interval = "30s"
    timeout = "10s"
  }
  
  check {
    http = "http://api:3001/health/live"
    interval = "10s"
    timeout = "5s"
  }
  
  meta {
    version = "2.0.0"
    environment = "development"
  }
}

services {
  name = "heimdall-database"
  port = 5432
  tags = ["database", "postgres", "storage"]
  
  check {
    tcp = "database:5432"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "15"
    environment = "development"
  }
}

services {
  name = "heimdall-redis"
  port = 6379
  tags = ["cache", "redis", "storage"]
  
  check {
    tcp = "redis:6379"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "7"
    environment = "development"
  }
}

services {
  name = "heimdall-prometheus"
  port = 9090
  tags = ["monitoring", "metrics", "prometheus"]
  
  check {
    http = "http://prometheus:9090/-/healthy"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "latest"
    environment = "development"
  }
}

services {
  name = "heimdall-grafana"
  port = 3000
  tags = ["monitoring", "visualization", "grafana"]
  
  check {
    http = "http://grafana:3000/api/health"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "latest"
    environment = "development"
  }
}
