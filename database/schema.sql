
-- Drop exsisting tables
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activities table
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('assignment', 'quiz', 'exam', 'project', 'reading', 'other')),
    deadline TIMESTAMP NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    url TEXT,
    source VARCHAR(100), -- e.g., 'lms_page', 'manual', 'import'
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes 
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_deadline ON activities(deadline);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_priority ON activities(priority);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_user_status ON activities(user_id, status);
CREATE INDEX idx_activities_user_deadline ON activities(user_id, deadline);
CREATE INDEX idx_users_email ON users(email);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at 
    BEFORE UPDATE ON activities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for activity statistics
CREATE OR REPLACE VIEW activity_stats AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    COUNT(a.id) as total_activities,
    COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_activities,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_activities,
    COUNT(CASE WHEN a.deadline < NOW() AND a.status = 'pending' THEN 1 END) as overdue_activities,
    COUNT(CASE WHEN a.priority = 'high' THEN 1 END) as high_priority_activities
FROM users u
LEFT JOIN activities a ON u.id = a.user_id
GROUP BY u.id, u.name;

-- Insert some sample data (optional - for testing)

/*
-- Sample user (password is 'password123' hashed with bcrypt)
INSERT INTO users (name, email, password) VALUES 
('Test User', 'test@example.com', '$2a$10$rZ7qJfV5K0nkN5P5xkXKa.Y5X5hZ5K5n5K5n5K5n5K5n5K5n5K5n5');

-- Sample activities
INSERT INTO activities (user_id, title, type, deadline, description, priority, status) VALUES
(1, 'Complete Chapter 5 Assignment', 'assignment', NOW() + INTERVAL '3 days', 'Read and complete all exercises from Chapter 5', 'high', 'pending'),
(1, 'Mathematics Quiz', 'quiz', NOW() + INTERVAL '1 day', 'Online quiz covering topics 1-5', 'high', 'pending'),
(1, 'Final Project Submission', 'project', NOW() + INTERVAL '14 days', 'Submit completed final project with documentation', 'high', 'pending'),
(1, 'Weekly Reading', 'reading', NOW() + INTERVAL '5 days', 'Read assigned chapters for next week', 'medium', 'pending'),
(1, 'Previous Assignment', 'assignment', NOW() - INTERVAL '2 days', 'This one is overdue', 'medium', 'completed');
*/

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lms_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lms_user;

COMMENT ON TABLE users IS 'Stores user account information';
COMMENT ON TABLE activities IS 'Stores LMS activities and tasks';
COMMENT ON COLUMN activities.source IS 'Indicates where the activity was created from (lms_page, manual, import)';
COMMENT ON COLUMN activities.url IS 'Optional URL link to the activity in the LMS';
