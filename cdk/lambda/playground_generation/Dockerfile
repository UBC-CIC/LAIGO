# Multi-stage build for smaller images
FROM public.ecr.aws/lambda/python:3.12 as builder

# Install build dependencies
RUN dnf -y install postgresql-devel gcc libpq gcc-c++

# Install Python packages in a separate directory
WORKDIR /install
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/install -r requirements.txt

# Final stage - minimal image
FROM public.ecr.aws/lambda/python:3.12

# Copy only the installed packages
COPY --from=builder /install ${LAMBDA_RUNTIME_DIR}/

# Show installed packages (for debugging)
RUN pip list

# Copy application code
WORKDIR ${LAMBDA_TASK_ROOT}
COPY src/ ${LAMBDA_TASK_ROOT}

# Set Lambda handler
CMD [ "main.handler" ]