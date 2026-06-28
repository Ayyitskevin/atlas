output "database_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "attachments_bucket" {
  value = aws_s3_bucket.attachments.bucket
}
