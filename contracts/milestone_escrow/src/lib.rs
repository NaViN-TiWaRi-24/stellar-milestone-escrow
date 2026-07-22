#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, vec, Address, Env, String, Vec,
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
}

#[contract]
pub struct MilestoneEscrowContract;

#[contractimpl]
impl MilestoneEscrowContract {
    // Temporary function retained only while the real escrow functions are added.
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }
}

mod test;
