FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for psycopg[binary] and build tools for numpy
RUN dnf -y install postgresql-devel gcc libpq gcc-c++ \
    && dnf clean all \
    && rm -rf /var/cache/dnf # Clean up dnf cache to keep image size down

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy the  requirements.txt file
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Show installed packages (for debugging)
RUN pip list

# Copy source code
COPY src/ ${LAMBDA_TASK_ROOT}

# Set Lambda handler
CMD [ "main.handler" ]
