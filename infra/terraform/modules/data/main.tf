resource "aws_security_group" "data" {
  name   = "${var.name}-data"
  vpc_id = var.vpc_id
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "postgres" {
  allocated_storage      = 20
  db_name                = "atlas"
  db_subnet_group_name   = aws_db_subnet_group.this.name
  engine                 = "postgres"
  engine_version         = "17"
  identifier             = "${var.name}-postgres"
  instance_class         = "db.t4g.micro"
  password               = "replace-me-through-secrets"
  publicly_accessible    = false
  skip_final_snapshot    = true
  username               = "atlas"
  vpc_security_group_ids = [aws_security_group.data.id]
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis"
  subnet_ids = var.subnet_ids
}

resource "aws_s3_bucket" "attachments" {
  bucket_prefix = "${var.name}-attachments-"
}
