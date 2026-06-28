output "vpc_id" {
  value = module.network.vpc_id
}

output "database_endpoint" {
  value     = module.data.database_endpoint
  sensitive = true
}
