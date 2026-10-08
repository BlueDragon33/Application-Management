# Engineering Suite management boundary

Status: **FOUNDATION**

Application Management recognizes three independent Engineering Suite clients:

- CAD CAM 3D — `BlueDragon33/CAD_CAM_3D` — device namespace `CAD-`;
- ECAD Design — `BlueDragon33/ECAD_Design` — device namespace `ECAD-`;
- CAE Simulation — `BlueDragon33/CAE_Simulation` — device namespace `CAE-`.

All are Level-1 clients. None is a sub-client of another.

## Control-plane ownership

Application Management may coordinate:

- application registration;
- approved management-device access;
- UI/feature policy;
- safe runtime/readiness metadata;
- safe operational audit;
- future remote commands only after a real signed Control API exists.

It must not own or mirror:

### CAD
- project/feature history;
- B-Rep/mesh;
- STL/STEP/3MF.

### ECAD
- schematic;
- netlist;
- PCB layout;
- Gerber/Drill/BOM project payloads.

### CAE
- study definitions;
- mesh;
- solver input decks;
- solver result fields.

## Suite relationships

CAD, ECAD and CAE exchange engineering artifacts through the canonical interoperability contracts governed by Software-Blueprint-Hub. Application Management is not a data bus between the engineering products.

## Current readiness

CAD has an active product foundation and preview runtime.

ECAD and CAE are foundation-only. Their registry entries remain `planned + pending`; the generic admin workspace exists only to show truthful boundary/readiness metadata. No remote action is exposed and no runtime Website URL is advertised.

CI success does not promote any of the three clients to Production or `connected`.
