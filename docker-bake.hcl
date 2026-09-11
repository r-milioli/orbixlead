variable "REGISTRY" {
  default = "automacaodebaixocusto/orbixlead"
}

group "default" {
  targets = ["web", "api", "scraper"]
}

target "web" {
  context    = "."
  dockerfile = "apps/web/Dockerfile"
  tags       = ["${REGISTRY}:web"]
  args = {
    API_INTERNAL_URL = "http://api:4000"
  }
}

target "api" {
  context    = "."
  dockerfile = "apps/api/Dockerfile"
  tags       = ["${REGISTRY}:api"]
}

target "scraper" {
  context    = "."
  dockerfile = "apps/scraper/Dockerfile"
  tags       = ["${REGISTRY}:scraper"]
}
