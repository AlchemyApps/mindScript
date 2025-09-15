terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# S3 bucket for CloudFront logs
resource "aws_s3_bucket" "cdn_logs" {
  bucket = "${var.project_name}-${var.environment}-cdn-logs"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cdn-logs"
  })
}

resource "aws_s3_bucket_ownership_controls" "cdn_logs" {
  bucket = aws_s3_bucket.cdn_logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "cdn_logs" {
  depends_on = [aws_s3_bucket_ownership_controls.cdn_logs]

  bucket = aws_s3_bucket.cdn_logs.id
  acl    = "private"
}

resource "aws_s3_bucket_lifecycle_configuration" "cdn_logs" {
  bucket = aws_s3_bucket.cdn_logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

# CloudFront Origin Access Identity for private content
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "${var.project_name}-${var.environment}-oai"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}-${var.environment} CDN"
  default_root_object = "index.html"
  aliases             = [var.custom_domain]
  price_class         = var.price_class
  http_version        = "http2and3"

  # Supabase Storage Origin
  origin {
    domain_name = replace(var.supabase_storage_url, "https://", "")
    origin_id   = "supabase-storage"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
      origin_keepalive_timeout = 60
    }

    custom_header {
      name  = "X-CDN-Secret"
      value = random_password.cdn_secret.result
    }
  }

  # Logging configuration
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cdn_logs.bucket_domain_name
    prefix          = "cloudfront/"
  }

  # Default cache behavior for public content
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "supabase-storage"

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000  # 1 year
    compress               = true

    # Response headers policy for CORS
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  # Cache behavior for public tracks (7 days cache)
  ordered_cache_behavior {
    path_pattern     = "/public/tracks/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "supabase-storage"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 604800   # 7 days
    max_ttl                = 2592000   # 30 days
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  # Cache behavior for private tracks (no cache, requires signed URLs)
  ordered_cache_behavior {
    path_pattern     = "/private/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "supabase-storage"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true

    trusted_signers        = ["self"]
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  # Cache behavior for images (30 days cache)
  ordered_cache_behavior {
    path_pattern     = "/images/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "supabase-storage"

    forwarded_values {
      query_string = true
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 2592000   # 30 days
    max_ttl                = 31536000   # 1 year
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  # Cache behavior for static assets (1 year cache)
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "supabase-storage"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 31536000  # 1 year
    max_ttl                = 31536000  # 1 year
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  # Geo-restriction configuration
  restrictions {
    geo_restriction {
      restriction_type = length(var.geo_restrictions) > 0 ? "whitelist" : "none"
      locations        = var.geo_restrictions
    }
  }

  # SSL/TLS certificate configuration
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # WAF integration if provided
  web_acl_id = var.waf_web_acl_id != "" ? var.waf_web_acl_id : null

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cdn"
  })
}

# Response Headers Policy for CORS
resource "aws_cloudfront_response_headers_policy" "cors" {
  name = "${var.project_name}-${var.environment}-cors-policy"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["*"]
    }

    access_control_max_age_sec = 86400

    origin_override = true
  }

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }
}

# Random password for CDN secret header
resource "random_password" "cdn_secret" {
  length  = 32
  special = true
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cache_hit_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-cdn-cache-hit-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors CloudFront cache hit rate"
  alarm_actions       = []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "origin_latency" {
  alarm_name          = "${var.project_name}-${var.environment}-cdn-origin-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "OriginLatency"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "1000"
  alarm_description   = "This metric monitors CloudFront origin latency"
  alarm_actions       = []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-cdn-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "This metric monitors CloudFront 4xx error rate"
  alarm_actions       = []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = var.tags
}