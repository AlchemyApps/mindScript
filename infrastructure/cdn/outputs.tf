output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "cloudfront_oai_iam_arn" {
  description = "CloudFront Origin Access Identity IAM ARN"
  value       = aws_cloudfront_origin_access_identity.main.iam_arn
}

output "cdn_logs_bucket" {
  description = "S3 bucket for CDN logs"
  value       = aws_s3_bucket.cdn_logs.id
}

output "cdn_secret_header_value" {
  description = "Secret header value for origin verification"
  value       = random_password.cdn_secret.result
  sensitive   = true
}

output "cache_hit_rate_alarm" {
  description = "CloudWatch alarm for cache hit rate"
  value       = aws_cloudwatch_metric_alarm.cache_hit_rate.alarm_name
}

output "origin_latency_alarm" {
  description = "CloudWatch alarm for origin latency"
  value       = aws_cloudwatch_metric_alarm.origin_latency.alarm_name
}

output "error_rate_alarm" {
  description = "CloudWatch alarm for error rate"
  value       = aws_cloudwatch_metric_alarm.error_rate.alarm_name
}