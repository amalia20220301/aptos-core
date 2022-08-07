// Copyright (c) The Aptos Foundation
// SPDX-License-Identifier: Apache-2.0

import { FAUCET_URL, NODE_URL, accountBalance } from "./first_transaction";
import { AptosAccount, TxnBuilderTypes, TransactionBuilder, AptosClient, HexString, FaucetClient } from "aptos";
const {BCS} = TransactionBuilder;

//:!:>section_1
function serializeVectorBool(vecBool: boolean[]) {
  const serializer = new BCS.Serializer();
  serializer.serializeU32AsUleb128(vecBool.length);
  vecBool.forEach((el) => {
    serializer.serializeBool(el);
  });
  return serializer.getBytes();
}

const NUMBER_MAX: number = 9007199254740991;
const client = new AptosClient(NODE_URL);
/** Creates a new collection within the specified account */
async function createCollection(account: AptosAccount, name: string, description: string, uri: string) {
  const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
    TxnBuilderTypes.ScriptFunction.natural(
      "0x3::token",
      "create_collection_script",
      [],
      [
        BCS.bcsSerializeStr(name),
        BCS.bcsSerializeStr(description),
        BCS.bcsSerializeStr(uri),
        BCS.bcsSerializeUint64(NUMBER_MAX),
        serializeVectorBool([false, false, false]),
      ],
    ),
  );

  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(account.address()),
    client.getChainId(),
  ]);

  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(account.address()),
    BigInt(sequenceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  const bcsTxn = AptosClient.generateBCSTransaction(account, rawTxn);
  const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);
  await client.waitForTransaction(pendingTxn.hash);
}
//<:!:section_1

//:!:>section_2
async function createToken(
  account: AptosAccount,
  collection_name: string,
  name: string,
  description: string,
  supply: number | bigint,
  uri: string,
) {
  // Serializes empty arrays
  const serializer = new BCS.Serializer();
  serializer.serializeU32AsUleb128(0);

  const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
    TxnBuilderTypes.ScriptFunction.natural(
      "0x3::token",
      "create_token_script",
      [],
      [
        BCS.bcsSerializeStr(collection_name),
        BCS.bcsSerializeStr(name),
        BCS.bcsSerializeStr(description),
        BCS.bcsSerializeUint64(supply),
        BCS.bcsSerializeUint64(NUMBER_MAX),
        BCS.bcsSerializeStr(uri),
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(account.address())),
        BCS.bcsSerializeUint64(0),
        BCS.bcsSerializeUint64(0),
        serializeVectorBool([false, false, false, false, false]),
        serializer.getBytes(),
        serializer.getBytes(),
        serializer.getBytes(),
      ],
    ),
  );

  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(account.address()),
    client.getChainId(),
  ]);

  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(account.address()),
    BigInt(sequenceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  const bcsTxn = AptosClient.generateBCSTransaction(account, rawTxn);
  const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);
  await client.waitForTransaction(pendingTxn.hash);
}
//<:!:section_2

//:!:>section_4
async function offerToken(
  account: AptosAccount,
  receiver: HexString,
  creator: HexString,
  collection_name: string,
  token_name: string,
  amount: number,
) {
  const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
    TxnBuilderTypes.ScriptFunction.natural(
      "0x3::token_transfers",
      "offer_script",
      [],
      [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(receiver.hex())),
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(creator.hex())),
        BCS.bcsSerializeStr(collection_name),
        BCS.bcsSerializeStr(token_name),
        BCS.bcsSerializeUint64(0),
        BCS.bcsSerializeUint64(amount),
      ],
    ),
  );

  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(account.address()),
    client.getChainId(),
  ]);

  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(account.address()),
    BigInt(sequenceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  const bcsTxn = AptosClient.generateBCSTransaction(account, rawTxn);
  const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);
  await client.waitForTransaction(pendingTxn.hash);
}
//<:!:section_4

//:!:>section_5
async function claimToken(
  account: AptosAccount,
  sender: HexString,
  creator: HexString,
  collection_name: string,
  token_name: string,
) {
  const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
    TxnBuilderTypes.ScriptFunction.natural(
      "0x3::token_transfers",
      "claim_script",
      [],
      [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(sender.hex())),
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(creator.hex())),
        BCS.bcsSerializeStr(collection_name),
        BCS.bcsSerializeStr(token_name),
        BCS.bcsSerializeUint64(0),
      ],
    ),
  );

  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(account.address()),
    client.getChainId(),
  ]);

  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(account.address()),
    BigInt(sequenceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  const bcsTxn = AptosClient.generateBCSTransaction(account, rawTxn);
  const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);
  await client.waitForTransaction(pendingTxn.hash);
}
//<:!:section_5

async function cancelTokenOffer(
  account: AptosAccount,
  receiver: HexString,
  creator: HexString,
  token_creation_num: number,
) {
  const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
    TxnBuilderTypes.ScriptFunction.natural(
      "0x3::token_transfers",
      "cancel_offer_script",
      [],
      [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(receiver.hex())),
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(creator.hex())),
        BCS.bcsSerializeUint64(token_creation_num),
      ],
    ),
  );

  const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
    client.getAccount(account.address()),
    client.getChainId(),
  ]);

  const rawTxn = new TxnBuilderTypes.RawTransaction(
    TxnBuilderTypes.AccountAddress.fromHex(account.address()),
    BigInt(sequenceNumber),
    scriptFunctionPayload,
    1000n,
    1n,
    BigInt(Math.floor(Date.now() / 1000) + 10),
    new TxnBuilderTypes.ChainId(chainId),
  );

  const bcsTxn = AptosClient.generateBCSTransaction(account, rawTxn);
  const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);
  await client.waitForTransaction(pendingTxn.hash);
}

//:!:>section_3
async function tableItem(handle: string, keyType: string, valueType: string, key: any): Promise<any> {
  const getTokenTableItemRequest = {
    key_type: keyType,
    value_type: valueType,
    key,
  };
  return client.getTableItem(handle, getTokenTableItemRequest);
}

async function getTokenBalance(
  owner: HexString,
  creator: HexString,
  collection_name: string,
  token_name: string,
): Promise<number> {
  const token_store = await client.getAccountResource(owner, {
      address: "0x3",
      module: 'token',
      name: 'TokenStore',
      generic_type_params: []
  });

  const token_data_id = {
    creator: creator.hex(),
    collection: collection_name,
    name: token_name,
  };

  const token_id = {
    token_data_id,
    property_version: "0",
  };

  const token = await tableItem(
    (token_store.data as any)["tokens"]["handle"],
    "0x3::token::TokenId",
    "0x3::token::Token",
    token_id,
  );
    console.log('-----token-----------',token)
  return token.amount;
}

async function getTokenData(creator: HexString, collection_name: string, token_name: string): Promise<any> {
  const collections = await client.getAccountResource(creator, {
      address: "0x3",
      module: 'token',
      name: 'Collections',
      generic_type_params: []
  });

  const token_data_id = {
    creator: creator.hex(),
    collection: collection_name,
    name: token_name,
  };

  const token = await tableItem(
    (collections.data as any)["token_data"]["handle"],
    "0x3::token::TokenDataId",
    "0x3::token::TokenData",
    token_data_id,
  );
  return token.data;
}
//<:!:section_3

async function main() {
  // const faucet_client = new FaucetClient(NODE_URL, FAUCET_URL);

    const alice = new AptosAccount(new Uint8Array([
        244, 120, 158, 140, 100,  79, 240,  51, 229, 191,  13,
        217, 180, 117,  70, 232,  44,  60, 163,  78, 167, 167,
        153, 231,  38,  18, 133, 191,   8,  73, 246, 144,  24,
        212, 218,  13, 146, 222, 198, 165,  93, 167, 106, 227,
        206, 235, 141, 193, 156,  53, 169, 179, 224,  53, 167,
        145,  11,  94,  41, 233, 185,  80, 126, 162
    ]),"0xd71a3290dc8cdac1e1698f96899285bc107f3535883844345203839d86c7cbe6");

    const bob = new AptosAccount(new Uint8Array([
        18,  33, 246, 139, 200,  25, 211, 190, 219, 124, 206,
        172,  75, 135, 143,  83, 139,  56, 107,  73,  21,   0,
        209,  68,  10, 235, 112,  81, 116, 228,  88, 111,  95,
        211, 141, 104, 116, 225,  84,  34, 130,  83,   6, 156,
        55,  16, 172, 157,  34, 179, 116, 129,  25, 169, 116,
        107, 171, 194,  61, 249,  17, 222,  60,  12
    ]),"0x02c6ce72e37bbc4d49dc3e165509f896259035d7fe81acdb5e02c25bf7d8c782");

    const collection_name = "Alice's cat collection";
  const token_name = "Alice's tabby";

  console.log("\n=== Addresses ===");
  console.log(
    `Alice: ${alice.address()}. Key Seed: ${Buffer.from(alice.signingKey.secretKey).toString("hex").slice(0, 64)}`,
  );
  console.log(`Bob: ${bob.address()}. Key Seed: ${Buffer.from(bob.signingKey.secretKey).toString("hex").slice(0, 64)}`);

  // await faucet_client.fundAccount(alice.address(), 5_000);
  // await faucet_client.fundAccount(bob.address(), 5_000);

  console.log("\n=== Initial Balances ===");
  console.log(`Alice: ${await accountBalance(alice.address())}`);
  console.log(`Bob: ${await accountBalance(bob.address())}`);

  console.log("\n=== Creating Collection and Token ===");

  // await createCollection(alice, collection_name, "Alice's simple collection", "https://aptos.dev");
  // await createToken(
  //   alice,
  //   collection_name,
  //   token_name,
  //   "Alice's tabby",
  //   1,
  //   "https://aptos.dev/img/nyan.jpeg", //TODO: replace with uri link matching ERC1155 off-chain standard
  // );
    try{
        let token_balance = await getTokenBalance(alice.address(), alice.address(), collection_name, token_name);
        console.log(`Alice's token balance: ${token_balance}`);
        const token_data = await getTokenData(alice.address(), collection_name, token_name);
        console.log(`Alice's token data: ${JSON.stringify(token_data)}`);

        console.log("\n=== Transferring the token to Bob ===");
        await offerToken(alice, bob.address(), alice.address(), collection_name, token_name, 1);
        await claimToken(bob, alice.address(), alice.address(), collection_name, token_name);

        token_balance = await getTokenBalance(alice.address(), alice.address(), collection_name, token_name);
        console.log(`Alice's token balance: ${token_balance}`);
        token_balance = await getTokenBalance(bob.address(), alice.address(), collection_name, token_name);
        console.log(`Bob's token balance: ${token_balance}`);
    }catch(e){
        console.log('-------e---------',e)
    }
}

if (require.main === module) {
  main().then((resp) => console.log(resp));
}
