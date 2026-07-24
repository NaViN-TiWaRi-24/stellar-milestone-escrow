#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Vec,
};

/// Soroban Testnet targets roughly one ledger close every five seconds.
const LEDGERS_PER_DAY: u32 = 17_280;
/// Renew entries once fewer than 30 days remain.
const TTL_RENEWAL_THRESHOLD_LEDGERS: u32 = 30 * LEDGERS_PER_DAY;
/// Keep active escrow data alive for approximately 180 days.
const ESCROW_TTL_LEDGERS: u32 = 180 * LEDGERS_PER_DAY;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProjectStatus {
    Created,
    Accepted,
    Funded,
    Active,
    Completed,
    Cancelled,
    RefundRequested,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Paid,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneInput {
    pub title: String,
    pub amount: i128,
    pub deadline: u64,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub id: u32,
    pub title: String,
    pub amount: i128,
    pub deadline: u64,
    pub work_reference: String,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Project {
    pub id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub asset: Address,
    pub title: String,
    pub total_amount: i128,
    pub escrowed_amount: i128,
    pub released_amount: i128,
    pub milestones: Vec<Milestone>,
    pub status: ProjectStatus,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    NextProjectId,
    Project(u64),
    UserProjects(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    InvalidAmount = 1,
    InvalidDeadline = 2,
    EmptyMilestones = 3,
    MilestoneTotalMismatch = 4,
    ProjectNotFound = 5,
    Unauthorized = 6,
    InvalidProjectState = 7,
    InvalidMilestoneState = 8,
    AlreadyFunded = 9,
    AlreadyPaid = 10,
    MilestoneNotFound = 11,
    EmptyWorkReference = 12,
    InsufficientEscrow = 13,
    ArithmeticOverflow = 14,
    InvalidParticipant = 15,
}

#[contractevent]
pub struct ProjectCreated {
    #[topic]
    pub project_id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub total_amount: i128,
}

#[contractevent]
pub struct ProjectAccepted {
    #[topic]
    pub project_id: u64,
    pub freelancer: Address,
}

#[contractevent]
pub struct ProjectFunded {
    #[topic]
    pub project_id: u64,
    pub client: Address,
    pub amount: i128,
}

#[contractevent]
pub struct MilestoneSubmitted {
    #[topic]
    pub project_id: u64,
    #[topic]
    pub milestone_id: u32,
    pub freelancer: Address,
}

#[contractevent]
pub struct MilestoneApproved {
    #[topic]
    pub project_id: u64,
    #[topic]
    pub milestone_id: u32,
    pub client: Address,
}

#[contractevent]
pub struct MilestonePaid {
    #[topic]
    pub project_id: u64,
    #[topic]
    pub milestone_id: u32,
    pub freelancer: Address,
    pub amount: i128,
}

#[contractevent]
pub struct ProjectCancelled {
    #[topic]
    pub project_id: u64,
    pub client: Address,
}

#[contractevent]
pub struct RefundRequested {
    #[topic]
    pub project_id: u64,
    pub client: Address,
}

#[contractevent]
pub struct ProjectRefunded {
    #[topic]
    pub project_id: u64,
    pub client: Address,
    pub amount: i128,
}
#[contract]
pub struct MilestoneEscrowContract;

fn renew_instance_ttl(env: &Env) {
    // Instance storage has one shared TTL, so this renews NextProjectId together
    // with the contract instance and its executable code.
    env.storage()
        .instance()
        .extend_ttl(TTL_RENEWAL_THRESHOLD_LEDGERS, ESCROW_TTL_LEDGERS);
}

fn renew_project_ttl(env: &Env, project: &Project) {
    let project_key = DataKey::Project(project.id);
    let client_projects_key = DataKey::UserProjects(project.client.clone());
    let freelancer_projects_key = DataKey::UserProjects(project.freelancer.clone());

    env.storage().persistent().extend_ttl(
        &project_key,
        TTL_RENEWAL_THRESHOLD_LEDGERS,
        ESCROW_TTL_LEDGERS,
    );
    env.storage().persistent().extend_ttl(
        &client_projects_key,
        TTL_RENEWAL_THRESHOLD_LEDGERS,
        ESCROW_TTL_LEDGERS,
    );
    env.storage().persistent().extend_ttl(
        &freelancer_projects_key,
        TTL_RENEWAL_THRESHOLD_LEDGERS,
        ESCROW_TTL_LEDGERS,
    );
    renew_instance_ttl(env);
}

#[contractimpl]
impl MilestoneEscrowContract {
    // Temporary function retained only while the real escrow functions are added.
    pub fn create_project(
        env: Env,
        client: Address,
        freelancer: Address,
        asset: Address,
        title: String,
        total_amount: i128,
        milestone_inputs: Vec<MilestoneInput>,
    ) -> Result<u64, EscrowError> {
        client.require_auth();
        if client == freelancer {
            return Err(EscrowError::InvalidParticipant);
        }

        if total_amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        if milestone_inputs.is_empty() {
            return Err(EscrowError::EmptyMilestones);
        }

        let current_time = env.ledger().timestamp();
        let mut calculated_total = 0_i128;
        let mut milestone_id = 0_u32;
        let mut milestones = Vec::new(&env);

        for input in milestone_inputs.iter() {
            if input.amount <= 0 {
                return Err(EscrowError::InvalidAmount);
            }

            if input.deadline <= current_time {
                return Err(EscrowError::InvalidDeadline);
            }

            calculated_total = calculated_total
                .checked_add(input.amount)
                .ok_or(EscrowError::InvalidAmount)?;

            milestones.push_back(Milestone {
                id: milestone_id,
                title: input.title,
                amount: input.amount,
                deadline: input.deadline,
                work_reference: String::from_str(&env, ""),
                status: MilestoneStatus::Pending,
            });

            milestone_id += 1;
        }

        if calculated_total != total_amount {
            return Err(EscrowError::MilestoneTotalMismatch);
        }

        let project_id = env
            .storage()
            .instance()
            .get(&DataKey::NextProjectId)
            .unwrap_or(1_u64);

        let project = Project {
            id: project_id,
            client,
            freelancer,
            asset,
            title,
            total_amount,
            escrowed_amount: 0,
            released_amount: 0,
            milestones,
            status: ProjectStatus::Created,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        let client_key = DataKey::UserProjects(project.client.clone());
        let mut client_projects: Vec<u64> = env
            .storage()
            .persistent()
            .get(&client_key)
            .unwrap_or(Vec::new(&env));

        client_projects.push_back(project_id);
        env.storage()
            .persistent()
            .set(&client_key, &client_projects);

        let freelancer_key = DataKey::UserProjects(project.freelancer.clone());
        let mut freelancer_projects: Vec<u64> = env
            .storage()
            .persistent()
            .get(&freelancer_key)
            .unwrap_or(Vec::new(&env));

        freelancer_projects.push_back(project_id);
        env.storage()
            .persistent()
            .set(&freelancer_key, &freelancer_projects);

        env.storage()
            .instance()
            .set(&DataKey::NextProjectId, &(project_id + 1));
        renew_project_ttl(&env, &project);

        ProjectCreated {
            project_id,
            client: project.client.clone(),
            freelancer: project.freelancer.clone(),
            total_amount: project.total_amount,
        }
        .publish(&env);
        Ok(project_id)
    }
    pub fn get_project(env: Env, project_id: u64) -> Result<Project, EscrowError> {
        env.storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .ok_or(EscrowError::ProjectNotFound)
    }
    pub fn get_user_projects(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserProjects(user))
            .unwrap_or(Vec::new(&env))
    }
    pub fn accept_project(
        env: Env,
        project_id: u64,
        freelancer: Address,
    ) -> Result<Project, EscrowError> {
        freelancer.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.freelancer != freelancer {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Created {
            return Err(EscrowError::InvalidProjectState);
        }

        project.status = ProjectStatus::Accepted;
        env.storage().persistent().set(&key, &project);
        renew_project_ttl(&env, &project);
        ProjectAccepted {
            project_id,
            freelancer,
        }
        .publish(&env);
        Ok(project)
    }
    pub fn fund_project(
        env: Env,
        project_id: u64,
        client: Address,
    ) -> Result<Project, EscrowError> {
        client.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.client != client {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Accepted {
            return Err(EscrowError::InvalidProjectState);
        }

        if project.escrowed_amount != 0 {
            return Err(EscrowError::AlreadyFunded);
        }

        project.escrowed_amount = project.total_amount;
        project.status = ProjectStatus::Funded;
        env.storage().persistent().set(&key, &project);

        let token_client = token::Client::new(&env, &project.asset);
        token_client.transfer(
            &client,
            &env.current_contract_address(),
            &project.total_amount,
        );
        renew_project_ttl(&env, &project);

        ProjectFunded {
            project_id,
            client,
            amount: project.total_amount,
        }
        .publish(&env);

        Ok(project)
    }

    pub fn submit_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u32,
        freelancer: Address,
        work_reference: String,
    ) -> Result<Project, EscrowError> {
        freelancer.require_auth();

        if work_reference.len() == 0 {
            return Err(EscrowError::EmptyWorkReference);
        }

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.freelancer != freelancer {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Funded && project.status != ProjectStatus::Active {
            return Err(EscrowError::InvalidProjectState);
        }

        let mut milestone = project
            .milestones
            .get(milestone_id)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != MilestoneStatus::Pending {
            return Err(EscrowError::InvalidMilestoneState);
        }

        milestone.work_reference = work_reference;
        milestone.status = MilestoneStatus::Submitted;
        project.milestones.set(milestone_id, milestone);
        project.status = ProjectStatus::Active;

        env.storage().persistent().set(&key, &project);
        renew_project_ttl(&env, &project);

        MilestoneSubmitted {
            project_id,
            milestone_id,
            freelancer,
        }
        .publish(&env);

        Ok(project)
    }
    pub fn approve_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u32,
        client: Address,
    ) -> Result<Project, EscrowError> {
        client.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.client != client {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Active {
            return Err(EscrowError::InvalidProjectState);
        }

        let mut milestone = project
            .milestones
            .get(milestone_id)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status != MilestoneStatus::Submitted {
            return Err(EscrowError::InvalidMilestoneState);
        }

        milestone.status = MilestoneStatus::Approved;
        project.milestones.set(milestone_id, milestone);

        env.storage().persistent().set(&key, &project);
        renew_project_ttl(&env, &project);

        MilestoneApproved {
            project_id,
            milestone_id,
            client,
        }
        .publish(&env);
        Ok(project)
    }
    pub fn release_milestone_payment(
        env: Env,
        project_id: u64,
        milestone_id: u32,
        client: Address,
    ) -> Result<Project, EscrowError> {
        client.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.client != client {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Active {
            return Err(EscrowError::InvalidProjectState);
        }

        let mut milestone = project
            .milestones
            .get(milestone_id)
            .ok_or(EscrowError::MilestoneNotFound)?;

        if milestone.status == MilestoneStatus::Paid {
            return Err(EscrowError::AlreadyPaid);
        }

        if milestone.status != MilestoneStatus::Approved {
            return Err(EscrowError::InvalidMilestoneState);
        }

        let new_released_amount = project
            .released_amount
            .checked_add(milestone.amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;

        if new_released_amount > project.escrowed_amount {
            return Err(EscrowError::InsufficientEscrow);
        }

        milestone.status = MilestoneStatus::Paid;
        project.milestones.set(milestone_id, milestone.clone());
        project.released_amount = new_released_amount;

        let mut all_paid = true;

        for stored_milestone in project.milestones.iter() {
            if stored_milestone.status != MilestoneStatus::Paid {
                all_paid = false;
                break;
            }
        }

        project.status = if all_paid {
            ProjectStatus::Completed
        } else {
            ProjectStatus::Active
        };

        env.storage().persistent().set(&key, &project);

        let token_client = token::Client::new(&env, &project.asset);
        token_client.transfer(
            &env.current_contract_address(),
            &project.freelancer,
            &milestone.amount,
        );
        renew_project_ttl(&env, &project);

        MilestonePaid {
            project_id,
            milestone_id,
            freelancer: project.freelancer.clone(),
            amount: milestone.amount,
        }
        .publish(&env);

        Ok(project)
    }
    pub fn cancel_project(
        env: Env,
        project_id: u64,
        client: Address,
    ) -> Result<Project, EscrowError> {
        client.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.client != client {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Created && project.status != ProjectStatus::Accepted {
            return Err(EscrowError::InvalidProjectState);
        }

        project.status = ProjectStatus::Cancelled;
        env.storage().persistent().set(&key, &project);
        renew_project_ttl(&env, &project);

        ProjectCancelled { project_id, client }.publish(&env);
        Ok(project)
    }
    pub fn request_refund(
        env: Env,
        project_id: u64,
        client: Address,
    ) -> Result<Project, EscrowError> {
        client.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.client != client {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::Funded && project.status != ProjectStatus::Active {
            return Err(EscrowError::InvalidProjectState);
        }

        if project.released_amount >= project.escrowed_amount {
            return Err(EscrowError::InsufficientEscrow);
        }

        project.status = ProjectStatus::RefundRequested;
        env.storage().persistent().set(&key, &project);
        renew_project_ttl(&env, &project);

        RefundRequested { project_id, client }.publish(&env);
        Ok(project)
    }
    pub fn approve_refund(
        env: Env,
        project_id: u64,
        freelancer: Address,
    ) -> Result<Project, EscrowError> {
        freelancer.require_auth();

        let key = DataKey::Project(project_id);
        let mut project: Project = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(EscrowError::ProjectNotFound)?;

        if project.freelancer != freelancer {
            return Err(EscrowError::Unauthorized);
        }

        if project.status != ProjectStatus::RefundRequested {
            return Err(EscrowError::InvalidProjectState);
        }

        let refund_amount = project
            .escrowed_amount
            .checked_sub(project.released_amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;

        if refund_amount <= 0 {
            return Err(EscrowError::InsufficientEscrow);
        }

        project.status = ProjectStatus::Refunded;
        env.storage().persistent().set(&key, &project);

        let token_client = token::Client::new(&env, &project.asset);
        token_client.transfer(
            &env.current_contract_address(),
            &project.client,
            &refund_amount,
        );
        renew_project_ttl(&env, &project);

        ProjectRefunded {
            project_id,
            client: project.client.clone(),
            amount: refund_amount,
        }
        .publish(&env);

        Ok(project)
    }
}

mod test;
