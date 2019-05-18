S3_PATH = s3://lukaskollmer/ieee-754-visualizer/


deploy:
	aws s3 sync --delete ./ ${S3_PATH} --exclude "*" --include "*.html" --include "*.js"
	aws cloudfront create-invalidation --distribution-id 'E36MZYDTD5MBGS' --paths '/ieee-754-visualizer/*'
