def test_health_endpoint(client):
    """Test that GET /api/health returns 200 and expected schema keys."""
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "version" in data
    assert "timestamp" in data
    assert "environment" in data
