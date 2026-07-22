#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProjectStatus {
    Created,
    Accepted,
    Funded,
    Active,
    Completed,
    Cancelled,
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
}

#[contract]
pub struct MilestoneEscrowContract;

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

        env.storage()
            .instance()
            .set(&DataKey::NextProjectId, &(project_id + 1));

        Ok(project_id)
    }
    pub fn get_project(env: Env, project_id: u64) -> Result<Project, EscrowError> {
        env.storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .ok_or(EscrowError::ProjectNotFound)
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

        Ok(project)
    }
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }
}

mod test;
