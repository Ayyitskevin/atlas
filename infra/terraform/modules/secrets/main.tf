resource "aws_secretsmanager_secret" "app" {
  name = "${var.name}/app"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL         = var.database_url
    REDIS_URL            = var.redis_url
    JWT_ACCESS_SECRET    = var.jwt_access_secret
    JWT_REFRESH_SECRET   = var.jwt_refresh_secret
    S3_ACCESS_KEY_ID     = var.s3_access_key_id
    S3_SECRET_ACCESS_KEY = var.s3_secret_access_key
    RESEND_API_KEY       = var.resend_api_key
  })
}
