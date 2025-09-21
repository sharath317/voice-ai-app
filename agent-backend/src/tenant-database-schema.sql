-- ===== MULTI-TENANT DATABASE SCHEMA =====

-- Enable Row Level Security for multi-tenant isolation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== TENANT MANAGEMENT TABLES =====

-- Main tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    plan_type VARCHAR(50) DEFAULT 'starter' CHECK (plan_type IN ('starter', 'professional', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Tenant branding configuration
CREATE TABLE tenant_branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    voice_id VARCHAR(100) DEFAULT '794f9389-aac1-45b6-b726-9d9369183238',
    greeting TEXT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#1e40af',
    secondary_color VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant sales process configuration
CREATE TABLE tenant_sales_process (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    stages JSONB NOT NULL DEFAULT '[]'::jsonb,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    scoring_weights JSONB NOT NULL DEFAULT '{"budget": 0.3, "authority": 0.2, "need": 0.3, "timeline": 0.2}'::jsonb,
    qualification_threshold INTEGER DEFAULT 6 CHECK (qualification_threshold >= 0 AND qualification_threshold <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant integrations
CREATE TABLE tenant_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN ('crm', 'calendar', 'analytics', 'email', 'slack')),
    provider VARCHAR(50) NOT NULL,
    api_key_encrypted TEXT,
    webhook_url VARCHAR(500),
    configuration JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, integration_type, provider)
);

-- Tenant features and limits
CREATE TABLE tenant_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    configuration JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, feature_name)
);

CREATE TABLE tenant_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    limit_name VARCHAR(100) NOT NULL,
    limit_value INTEGER NOT NULL,
    current_usage INTEGER DEFAULT 0,
    reset_period VARCHAR(20) DEFAULT 'monthly' CHECK (reset_period IN ('daily', 'weekly', 'monthly', 'yearly')),
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, limit_name)
);

-- ===== TENANT-SPECIFIC DATA TABLES =====

-- Call sessions with tenant isolation
CREATE TABLE call_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    participant_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    recording_url VARCHAR(500),
    transcript JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts with tenant isolation
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    external_id VARCHAR(100), -- CRM contact ID
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(100),
    company VARCHAR(255),
    company_size VARCHAR(50),
    source VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web', 'phone', 'referral', 'campaign')),
    lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 10),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
    last_contacted TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunities with tenant isolation
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    external_id VARCHAR(100), -- CRM opportunity ID
    stage VARCHAR(50) NOT NULL,
    budget_range VARCHAR(50),
    timeline VARCHAR(50),
    decision_makers TEXT,
    pain_points JSONB DEFAULT '[]'::jsonb,
    goals JSONB DEFAULT '[]'::jsonb,
    current_solution TEXT,
    challenges JSONB DEFAULT '[]'::jsonb,
    requirements JSONB DEFAULT '[]'::jsonb,
    deal_breakers JSONB DEFAULT '[]'::jsonb,
    next_steps TEXT,
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    estimated_value DECIMAL(12,2),
    close_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sentiment analysis with tenant isolation
CREATE TABLE sentiment_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    call_session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    engagement VARCHAR(20) CHECK (engagement IN ('high', 'medium', 'low')),
    interest_level VARCHAR(20) CHECK (interest_level IN ('very_high', 'high', 'medium', 'low', 'very_low')),
    notes TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive intelligence with tenant isolation
CREATE TABLE competitive_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    call_session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
    competitors JSONB DEFAULT '[]'::jsonb,
    current_vendor VARCHAR(255),
    competitor_reasons JSONB DEFAULT '[]'::jsonb,
    switching_reasons JSONB DEFAULT '[]'::jsonb,
    market_position VARCHAR(50),
    win_probability DECIMAL(3,2) CHECK (win_probability >= 0 AND win_probability <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Objections with tenant isolation
CREATE TABLE objections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    call_session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
    objection_text TEXT NOT NULL,
    category VARCHAR(50) CHECK (category IN ('price', 'timeline', 'features', 'trust', 'competition', 'budget', 'authority', 'need')),
    response TEXT,
    resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead scoring with tenant isolation
CREATE TABLE lead_scoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 10),
    fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 10),
    urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 10),
    budget_score INTEGER CHECK (budget_score >= 0 AND budget_score <= 10),
    authority_score INTEGER CHECK (authority_score >= 0 AND authority_score <= 10),
    need_score INTEGER CHECK (need_score >= 0 AND need_score <= 10),
    priority VARCHAR(10) CHECK (priority IN ('hot', 'warm', 'cold')),
    reasoning TEXT,
    scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ROW LEVEL SECURITY POLICIES =====

-- Enable RLS on all tenant-specific tables
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY tenant_isolation_call_sessions ON call_sessions
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_contacts ON contacts
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_opportunities ON opportunities
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_sentiment ON sentiment_analysis
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_competitive ON competitive_intelligence
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_objections ON objections
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

CREATE POLICY tenant_isolation_lead_scoring ON lead_scoring
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.current_tenant_id'));

-- ===== INDEXES FOR PERFORMANCE =====

-- Tenant-based indexes
CREATE INDEX idx_call_sessions_tenant_id ON call_sessions(tenant_id);
CREATE INDEX idx_call_sessions_tenant_status ON call_sessions(tenant_id, status);
CREATE INDEX idx_call_sessions_tenant_started ON call_sessions(tenant_id, started_at);

CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_tenant_email ON contacts(tenant_id, email);
CREATE INDEX idx_contacts_tenant_status ON contacts(tenant_id, status);
CREATE INDEX idx_contacts_tenant_lead_score ON contacts(tenant_id, lead_score);

CREATE INDEX idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_tenant_stage ON opportunities(tenant_id, stage);
CREATE INDEX idx_opportunities_tenant_contact ON opportunities(tenant_id, contact_id);

-- ===== FUNCTIONS AND TRIGGERS =====

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_branding_updated_at BEFORE UPDATE ON tenant_branding FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_sales_process_updated_at BEFORE UPDATE ON tenant_sales_process FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_integrations_updated_at BEFORE UPDATE ON tenant_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_features_updated_at BEFORE UPDATE ON tenant_features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_limits_updated_at BEFORE UPDATE ON tenant_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON call_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id_param VARCHAR(50))
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id_param, true);
END;
$$ LANGUAGE plpgsql;

-- ===== SAMPLE DATA =====

-- Insert sample tenants
INSERT INTO tenants (tenant_id, company_name, domain, plan_type) VALUES
('acme-corp', 'ACME Corporation', 'acme-corp.com', 'enterprise'),
('tech-startup', 'TechStart Inc', 'techstart.com', 'professional'),
('demo-company', 'Demo Company', 'demo.com', 'starter');

-- Insert sample branding
INSERT INTO tenant_branding (tenant_id, greeting, company_name, primary_color, secondary_color) VALUES
('acme-corp', 'Hello! I''m ACME''s AI Sales Assistant. I''m here to help you discover how our enterprise solutions can transform your business. Are you ready to get started?', 'ACME Corporation', '#1e40af', '#3b82f6'),
('tech-startup', 'Hey there! I''m TechStart''s AI Sales Bot. I''m here to help you explore our innovative tech solutions. Ready to dive in?', 'TechStart Inc', '#10b981', '#34d399'),
('demo-company', 'Hi! I''m your AI Sales Agent. How can I help you today?', 'Demo Company', '#6366f1', '#8b5cf6');

-- Insert sample sales processes
INSERT INTO tenant_sales_process (tenant_id, stages, questions, scoring_weights, qualification_threshold) VALUES
('acme-corp', 
 '["New Opportunity", "Prequalified", "Discovery", "Proposal", "Negotiation", "Closed Won"]'::jsonb,
 '["Hi! Thanks for reaching out to ACME. Can you tell me your name?", "What company do you represent?", "What''s your role in the organization?", "What challenges is your company currently facing?", "What''s your budget range for this type of solution?", "What''s your timeline for implementation?"]'::jsonb,
 '{"budget": 0.4, "authority": 0.3, "need": 0.2, "timeline": 0.1}'::jsonb,
 7),
('tech-startup',
 '["Lead", "Qualified", "Demo", "Trial", "Closed"]'::jsonb,
 '["Hi! What''s your name?", "What company are you with?", "What''s your role?", "What tech challenges are you trying to solve?", "What''s your budget for this?", "When do you need this implemented?"]'::jsonb,
 '{"budget": 0.2, "authority": 0.3, "need": 0.4, "timeline": 0.1}'::jsonb,
 5),
('demo-company',
 '["New Lead", "Qualified", "Discovery", "Proposal", "Closed"]'::jsonb,
 '["What''s your name?", "What company do you work for?", "What''s your role?", "What challenges are you facing?", "What''s your budget range?"]'::jsonb,
 '{"budget": 0.3, "authority": 0.2, "need": 0.3, "timeline": 0.2}'::jsonb,
 6);

-- Insert sample features
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled) VALUES
('acme-corp', 'sentiment_analysis', true),
('acme-corp', 'competitive_intelligence', true),
('acme-corp', 'objection_handling', true),
('acme-corp', 'lead_scoring', true),
('acme-corp', 'call_recording', true),
('tech-startup', 'sentiment_analysis', true),
('tech-startup', 'competitive_intelligence', false),
('tech-startup', 'objection_handling', true),
('tech-startup', 'lead_scoring', true),
('tech-startup', 'call_recording', false),
('demo-company', 'sentiment_analysis', true),
('demo-company', 'competitive_intelligence', false),
('demo-company', 'objection_handling', true),
('demo-company', 'lead_scoring', true),
('demo-company', 'call_recording', false);

-- Insert sample limits
INSERT INTO tenant_limits (tenant_id, limit_name, limit_value) VALUES
('acme-corp', 'max_calls_per_month', 5000),
('acme-corp', 'max_concurrent_calls', 50),
('tech-startup', 'max_calls_per_month', 1000),
('tech-startup', 'max_concurrent_calls', 20),
('demo-company', 'max_calls_per_month', 100),
('demo-company', 'max_concurrent_calls', 5);

