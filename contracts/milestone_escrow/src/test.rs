#![cfg(test)]

use super::{MilestoneEscrowContract, MilestoneEscrowContractClient};
use soroban_sdk::{vec, Env, String};

#[test]
fn hello_returns_expected_message() {
    let env = Env::default();
    let contract_id = env.register(MilestoneEscrowContract, ());
    let client = MilestoneEscrowContractClient::new(&env, &contract_id);

    let name = String::from_str(&env, "Stellar");
    let result = client.hello(&name);

    assert_eq!(
        result,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Stellar")
        ]
    );
}
