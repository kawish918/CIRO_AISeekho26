# Use an official lightweight Python runtime
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your local backend application code
COPY . .

# Expose the port that Cloud Run expects
EXPOSE 8080

# Run Uvicorn pointing to your FastAPI instance
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]