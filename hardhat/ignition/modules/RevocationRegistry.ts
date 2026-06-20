import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RevocationRegistryModule", (m) => {
  const issuerAddress = m.getParameter("issuerAddress");
  const registry = m.contract("RevocationRegistry", [issuerAddress]);

  return { registry };
});